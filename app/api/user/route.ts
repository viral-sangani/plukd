import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/user - Get current user profile
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user profile
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      // If user doesn't exist in users table yet, return auth user data
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || null,
          avatar_url: authUser.user_metadata?.avatar_url || null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
          created_at: authUser.created_at,
          updated_at: authUser.created_at
        })
      }
      console.error('Error fetching user:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error in user API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
