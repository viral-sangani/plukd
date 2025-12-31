import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Direct admin client (same as bot uses) to ensure consistency
function createDirectAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type UsersUpdate = Database['public']['Tables']['users']['Update']

// POST /api/telegram/link - Verify a linking code from the bot
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      )
    }

    // Use direct admin client (same as bot) to ensure consistency
    const adminSupabase = createDirectAdminClient()

    // Check if the code exists (for better error messages)
    const { data: anyCode } = await adminSupabase
      .from('telegram_link_codes')
      .select('id, code, telegram_chat_id, expires_at, used_at')
      .eq('code', code.toUpperCase())
      .single<{
        id: string
        code: string
        telegram_chat_id: string | null
        expires_at: string
        used_at: string | null
      }>()

    // Query for valid code (bot-created, unused, not expired)
    // Note: telegram_username column may not exist yet if migration 004 hasn't been applied
    const now = new Date().toISOString()
    const { data: linkCode, error: codeError } = await adminSupabase
      .from('telegram_link_codes')
      .select('id, telegram_chat_id')
      .eq('code', code.toUpperCase())
      .is('used_at', null)
      .gt('expires_at', now)
      .not('telegram_chat_id', 'is', null)
      .single<{
        id: string
        telegram_chat_id: string | null
      }>()

    if (codeError || !linkCode) {
      // Provide more specific error message
      if (anyCode && anyCode.used_at) {
        return NextResponse.json(
          { error: 'This code has already been used' },
          { status: 400 }
        )
      }
      if (anyCode && new Date(anyCode.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'This code has expired. Send /start to the bot to get a new code.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      )
    }

    // First, ensure user exists in users table (may not exist if just signed up)
    const { data: existingUser, error: userCheckError } = await adminSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (userCheckError && userCheckError.code === 'PGRST116') {
      // User doesn't exist in users table, create them
      const { error: createUserError } = await adminSupabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          telegram_chat_id: linkCode.telegram_chat_id,
          telegram_linked_at: new Date().toISOString()
        } as never)

      if (createUserError) {
        console.error('Error creating user:', createUserError)
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
    } else if (existingUser) {
      // User exists, update with telegram info
      const updateData: UsersUpdate = {
        telegram_chat_id: linkCode.telegram_chat_id,
        telegram_linked_at: new Date().toISOString()
      }

      const { error: updateError } = await adminSupabase
        .from('users')
        .update(updateData as never)
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating user telegram info:', updateError)
        return NextResponse.json(
          { error: 'Failed to link Telegram account' },
          { status: 500 }
        )
      }
    }

    // Mark code as used (skip user_id to avoid FK constraint if user was just created)
    const { error: markUsedError } = await adminSupabase
      .from('telegram_link_codes')
      .update({
        used_at: new Date().toISOString()
      } as never)
      .eq('id', linkCode.id)

    if (markUsedError) {
      console.error('Error marking code as used:', markUsedError)
      // Don't return error since linking succeeded
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Error verifying link code:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/telegram/link - Get current telegram status
export async function GET() {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user profile
    const { data: userData, error } = await supabase
      .from('users')
      .select('telegram_chat_id, telegram_username, telegram_linked_at')
      .eq('id', authUser.id)
      .single<{
        telegram_chat_id: string | null
        telegram_username: string | null
        telegram_linked_at: string | null
      }>()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching telegram status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch telegram status' },
        { status: 500 }
      )
    }

    // Handle case where user doesn't exist yet in the users table
    const telegramChatId = userData?.telegram_chat_id ?? null
    const telegramUsername = userData?.telegram_username ?? null
    const telegramLinkedAt = userData?.telegram_linked_at ?? null

    const isLinked = !!telegramChatId

    return NextResponse.json({
      isLinked,
      username: telegramUsername,
      linkedAt: telegramLinkedAt
    })
  } catch (error) {
    console.error('Error in telegram status API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/telegram/link - Disconnect telegram
export async function DELETE() {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Remove telegram connection
    const updateData: UsersUpdate = {
      telegram_chat_id: null,
      telegram_username: null,
      telegram_linked_at: null
    }
    const { error } = await supabase
      .from('users')
      .update(updateData as never)
      .eq('id', user.id)

    if (error) {
      console.error('Error disconnecting telegram:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect Telegram' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in telegram disconnect API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
