import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../config/supabase'
import { env } from '../config/env'
import { createBot, setupBotHandlers } from '../lib/telegram/bot'
import type { Database } from '@plukd/shared'

// Initialize bot instance for webhook handling
const bot = createBot()
setupBotHandlers(bot)

type UsersInsert = Database['public']['Tables']['users']['Insert']
type UsersUpdate = Database['public']['Tables']['users']['Update']

// Telegram API response types
interface TelegramWebhookInfo {
  url: string
  pending_update_count: number
  last_error_message?: string
  last_error_date?: number
}

interface TelegramApiResponse<T = unknown> {
  ok: boolean
  result?: T
  description?: string
}

export const telegramRoutes = new Hono()

// POST /webhook - Handle Telegram updates (NO auth - webhook from Telegram)
telegramRoutes.post('/webhook', async (c) => {
  try {
    // Verify secret token from Telegram
    const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token')

    if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('[telegram] Invalid webhook secret')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Get the update from Telegram
    const update = await c.req.json()
    console.log('[telegram] Received update:', JSON.stringify(update).slice(0, 200))

    // Process the update through Grammy bot handlers
    await bot.handleUpdate(update)

    return c.json({ status: 'ok' })
  } catch (error) {
    console.error('[telegram] Webhook error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /webhook - Health check
telegramRoutes.get('/webhook', async (c) => {
  return c.json({
    status: 'ok',
    message: 'Telegram webhook endpoint active',
  })
})

// Protected routes below - require authentication
telegramRoutes.use('/setup', authMiddleware)
telegramRoutes.use('/setup/*', authMiddleware)
telegramRoutes.use('/link', authMiddleware)
telegramRoutes.use('/link/*', authMiddleware)

// GET /setup - Check webhook status
telegramRoutes.get('/setup', async (c) => {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    )

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`)
    }

    const data = (await response.json()) as TelegramApiResponse<TelegramWebhookInfo>
    const info = data.result

    const expectedUrl = env.APP_URL
      ? `${env.APP_URL}/api/telegram/webhook`
      : '(APP_URL not configured)'

    return c.json({
      success: true,
      webhook: {
        url: info?.url || '(not set)',
        pendingUpdates: info?.pending_update_count ?? 0,
        lastError: info?.last_error_message ?? null,
        lastErrorDate: info?.last_error_date
          ? new Date(info.last_error_date * 1000).toISOString()
          : null,
      },
      expectedUrl,
      isCorrect: info?.url === expectedUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[telegram] Setup GET error:', error)
    return c.json({ success: false, error: message }, 500)
  }
})

// POST /setup - Register/update webhook
telegramRoutes.post('/setup', async (c) => {
  try {
    if (!env.APP_URL) {
      return c.json(
        { success: false, error: 'APP_URL environment variable is not configured' },
        500
      )
    }

    const webhookUrl = `${env.APP_URL}/api/telegram/webhook`

    // First, get current webhook info
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    )

    if (!infoResponse.ok) {
      throw new Error(`Failed to get webhook info: ${infoResponse.status}`)
    }

    const infoData = (await infoResponse.json()) as TelegramApiResponse<TelegramWebhookInfo>
    const currentUrl = infoData.result?.url

    // Check if webhook is already set correctly
    if (currentUrl === webhookUrl) {
      return c.json({
        success: true,
        updated: false,
        webhookUrl,
        message: 'Webhook already configured correctly',
      })
    }

    // Set the webhook
    const setResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: env.TELEGRAM_WEBHOOK_SECRET,
          allowed_updates: ['message', 'callback_query'],
        }),
      }
    )

    if (!setResponse.ok) {
      const errorData = (await setResponse.json()) as TelegramApiResponse
      throw new Error(errorData.description || `Failed to set webhook: ${setResponse.status}`)
    }

    const setData = (await setResponse.json()) as TelegramApiResponse

    if (!setData.ok) {
      return c.json(
        { success: false, error: setData.description || 'Failed to set webhook' },
        500
      )
    }

    return c.json({
      success: true,
      updated: true,
      webhookUrl,
      message: 'Webhook successfully updated',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[telegram] Setup POST error:', error)
    return c.json({ success: false, error: message }, 500)
  }
})

// DELETE /setup - Remove webhook (for debugging)
telegramRoutes.delete('/setup', async (c) => {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`
    )

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`)
    }

    const data = (await response.json()) as TelegramApiResponse

    if (!data.ok) {
      return c.json(
        { success: false, error: 'Failed to delete webhook' },
        500
      )
    }

    return c.json({
      success: true,
      message: 'Webhook deleted successfully',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[telegram] Setup DELETE error:', error)
    return c.json({ success: false, error: message }, 500)
  }
})

// Link code schema
const linkCodeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
})

// POST /link - Link Telegram account using a code
telegramRoutes.post('/link', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate request body
    const { code } = linkCodeSchema.parse(body)
    const normalizedCode = code.toUpperCase()

    // Check if the code exists (for better error messages)
    const { data: anyCode } = await supabaseAdmin
      .from('telegram_link_codes')
      .select('id, code, telegram_chat_id, expires_at, used_at')
      .eq('code', normalizedCode)
      .single<{
        id: string
        code: string
        telegram_chat_id: string | null
        expires_at: string
        used_at: string | null
      }>()

    // Query for valid code (bot-created, unused, not expired)
    const now = new Date().toISOString()
    const { data: linkCode, error: codeError } = await supabaseAdmin
      .from('telegram_link_codes')
      .select('id, telegram_chat_id, telegram_username')
      .eq('code', normalizedCode)
      .is('used_at', null)
      .gt('expires_at', now)
      .not('telegram_chat_id', 'is', null)
      .single<{ id: string; telegram_chat_id: string | null; telegram_username: string | null }>()

    if (codeError || !linkCode) {
      // Provide more specific error message
      if (anyCode && anyCode.used_at) {
        return c.json(
          { error: 'This code has already been used' },
          400
        )
      }
      if (anyCode && new Date(anyCode.expires_at) < new Date()) {
        return c.json(
          { error: 'This code has expired. Send /start to the bot to get a new code.' },
          400
        )
      }
      return c.json(
        { error: 'Invalid or expired code' },
        400
      )
    }

    // First, ensure user exists in users table (may not exist if just signed up)
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single<{ id: string }>()

    if (userCheckError && userCheckError.code === 'PGRST116') {
      // User doesn't exist in users table, create them
      const insertData: UsersInsert = {
        id: user.id,
        email: user.email || '',
        name: user.email?.split('@')[0] || 'User',
        telegram_chat_id: linkCode.telegram_chat_id,
        telegram_username: linkCode.telegram_username,
        telegram_linked_at: new Date().toISOString(),
      }

      const { error: createUserError } = await supabaseAdmin
        .from('users')
        .insert(insertData as never)

      if (createUserError) {
        console.error('[telegram] Error creating user:', createUserError)
        return c.json({ error: 'Failed to create user profile' }, 500)
      }
    } else if (existingUser) {
      // User exists, update with telegram info
      const updateData: UsersUpdate = {
        telegram_chat_id: linkCode.telegram_chat_id,
        telegram_username: linkCode.telegram_username,
        telegram_linked_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData as never)
        .eq('id', user.id)

      if (updateError) {
        console.error('[telegram] Error updating user telegram info:', updateError)
        return c.json({ error: 'Failed to link Telegram account' }, 500)
      }
    }

    // Mark code as used
    const { error: markUsedError } = await supabaseAdmin
      .from('telegram_link_codes')
      .update({ used_at: new Date().toISOString() } as never)
      .eq('id', linkCode.id)

    if (markUsedError) {
      console.error('[telegram] Error marking code as used:', markUsedError)
      // Don't return error since linking succeeded
    }

    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || 'Invalid request' }, 400)
    }
    console.error('[telegram] Link POST error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /link - Get current telegram link status
telegramRoutes.get('/link', async (c) => {
  try {
    const user = c.get('user')

    // Fetch user profile
    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('telegram_chat_id, telegram_username, telegram_linked_at')
      .eq('id', user.id)
      .single<{
        telegram_chat_id: string | null
        telegram_username: string | null
        telegram_linked_at: string | null
      }>()

    if (error && error.code !== 'PGRST116') {
      console.error('[telegram] Error fetching telegram status:', error)
      return c.json({ error: 'Failed to fetch telegram status' }, 500)
    }

    // Handle case where user doesn't exist yet in the users table
    const telegramChatId = userData?.telegram_chat_id ?? null
    const telegramUsername = userData?.telegram_username ?? null
    const telegramLinkedAt = userData?.telegram_linked_at ?? null

    const isLinked = !!telegramChatId

    return c.json({
      isLinked,
      username: telegramUsername,
      linkedAt: telegramLinkedAt,
    })
  } catch (error) {
    console.error('[telegram] Link GET error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /link - Disconnect telegram
telegramRoutes.delete('/link', async (c) => {
  try {
    const user = c.get('user')

    // Remove telegram connection
    const updateData: UsersUpdate = {
      telegram_chat_id: null,
      telegram_username: null,
      telegram_linked_at: null,
    }
    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData as never)
      .eq('id', user.id)

    if (error) {
      console.error('[telegram] Error disconnecting telegram:', error)
      return c.json({ error: 'Failed to disconnect Telegram' }, 500)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('[telegram] Link DELETE error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
