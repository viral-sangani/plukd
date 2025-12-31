/**
 * Next.js Instrumentation
 * Runs once when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid bundling issues
    const { ensureWebhook } = await import('@/lib/telegram/webhook')

    // Skip in development if no public URL is set
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl || appUrl.includes('localhost')) {
      console.log('[instrumentation] Skipping webhook registration (localhost detected)')
      console.log('[instrumentation] Set NEXT_PUBLIC_APP_URL to your ngrok/public URL to enable')
      return
    }

    console.log('[instrumentation] Registering Telegram webhook...')

    try {
      const result = await ensureWebhook()

      if (result.error) {
        console.error('[instrumentation] Failed to register webhook:', result.error)
      } else if (result.updated) {
        console.log('[instrumentation] Webhook registered:', result.expectedUrl)
      } else {
        console.log('[instrumentation] Webhook already configured:', result.expectedUrl)
      }
    } catch (error) {
      console.error('[instrumentation] Error registering webhook:', error)
    }
  }
}
