import { NextRequest, NextResponse } from 'next/server'
import { webhookCallback } from 'grammy'
import { createBot, setupBotHandlers } from '@/lib/telegram/bot'
import { ensureWebhookOnce } from '@/lib/telegram/webhook'

// POST /api/telegram/webhook - Handle incoming Telegram updates
export async function POST(request: NextRequest) {
  try {
    // Create bot instance and setup handlers
    const bot = createBot()
    setupBotHandlers(bot)

    // Get webhook secret from environment
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET

    // Use Grammy's webhookCallback with std/http adapter for Next.js App Router
    // Grammy handles secret verification automatically when secretToken is provided
    const handleUpdate = webhookCallback(bot, 'std/http', {
      secretToken,
      onTimeout: 'return',
      timeoutMilliseconds: 55000, // Just under Vercel's 60s limit
    })

    return await handleUpdate(request)
  } catch (error) {
    console.error('[telegram] Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/telegram/webhook - Health check + auto-register webhook
export async function GET() {
  try {
    // Auto-register webhook if not already set
    await ensureWebhookOnce()

    return NextResponse.json({
      status: 'ok',
      message: 'Telegram webhook endpoint is active',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}
