import { Bot } from 'grammy'

/**
 * Telegram Webhook Manager
 * Handles automatic webhook registration and verification
 */

interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
  max_connections?: number
  allowed_updates?: string[]
}

interface WebhookResponse {
  ok: boolean
  result: WebhookInfo
}

/**
 * Get the expected webhook URL based on environment
 */
export function getWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set')
  }
  return `${baseUrl}/api/telegram/webhook`
}

/**
 * Get current webhook info from Telegram
 */
export async function getWebhookInfo(): Promise<WebhookInfo> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set')
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const data: WebhookResponse = await response.json()

  if (!data.ok) {
    throw new Error('Failed to get webhook info from Telegram')
  }

  return data.result
}

/**
 * Register or update the webhook with Telegram
 */
export async function setWebhook(url: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set')
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  const payload = {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true, // Clear any stuck updates
  }

  console.log(`[telegram] Setting webhook to: ${url}`)
  console.log(`[telegram] Secret token provided: ${secret ? 'yes' : 'no'}`)

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!data.ok) {
    console.error(`[telegram] Failed to set webhook:`, data.description || data)
    return false
  }

  console.log(`[telegram] Webhook set successfully:`, data.description || 'ok')
  return true
}

/**
 * Delete the current webhook
 */
export async function deleteWebhook(): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set')
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
  })

  const data = await response.json()
  return data.ok === true
}

/**
 * Check if webhook needs to be updated and update if necessary
 * Returns true if webhook was updated, false if already correct
 */
export async function ensureWebhook(): Promise<{
  updated: boolean
  currentUrl: string
  expectedUrl: string
  error?: string
}> {
  try {
    const expectedUrl = getWebhookUrl()
    const webhookInfo = await getWebhookInfo()
    const currentUrl = webhookInfo.url

    // Check if webhook URL matches
    if (currentUrl === expectedUrl) {
      console.log(`[telegram] Webhook already configured: ${expectedUrl}`)
      return { updated: false, currentUrl, expectedUrl }
    }

    // Update webhook
    console.log(`[telegram] Updating webhook from "${currentUrl}" to "${expectedUrl}"`)
    const success = await setWebhook(expectedUrl)

    if (!success) {
      return {
        updated: false,
        currentUrl,
        expectedUrl,
        error: 'Failed to set webhook',
      }
    }

    console.log(`[telegram] Webhook successfully updated to: ${expectedUrl}`)
    return { updated: true, currentUrl: expectedUrl, expectedUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[telegram] Error ensuring webhook: ${message}`)
    return {
      updated: false,
      currentUrl: '',
      expectedUrl: '',
      error: message,
    }
  }
}

// Track if webhook has been verified this session
let webhookVerified = false

/**
 * Ensure webhook is set up (called once per server instance)
 * Uses in-memory flag to avoid repeated checks
 */
export async function ensureWebhookOnce(): Promise<void> {
  if (webhookVerified) {
    return
  }

  const result = await ensureWebhook()
  if (!result.error) {
    webhookVerified = true
  }
}
