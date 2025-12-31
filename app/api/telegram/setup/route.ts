import { NextRequest, NextResponse } from 'next/server'
import { ensureWebhook, getWebhookInfo, deleteWebhook } from '@/lib/telegram/webhook'

/**
 * GET /api/telegram/setup - Check webhook status
 */
export async function GET() {
  try {
    const info = await getWebhookInfo()

    return NextResponse.json({
      success: true,
      webhook: {
        url: info.url || '(not set)',
        pendingUpdates: info.pending_update_count,
        lastError: info.last_error_message,
        lastErrorDate: info.last_error_date
          ? new Date(info.last_error_date * 1000).toISOString()
          : null,
      },
      expectedUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`,
      isCorrect: info.url === `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/telegram/setup - Register/update webhook
 */
export async function POST(request: NextRequest) {
  try {
    const result = await ensureWebhook()

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      webhookUrl: result.expectedUrl,
      message: result.updated
        ? 'Webhook successfully updated'
        : 'Webhook already configured correctly',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/telegram/setup - Remove webhook (for debugging)
 */
export async function DELETE() {
  try {
    const success = await deleteWebhook()

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete webhook' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
