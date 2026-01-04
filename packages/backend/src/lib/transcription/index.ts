/**
 * Transcription Service
 *
 * Modular transcription system with pluggable providers.
 * Currently supports OpenAI Whisper, with plans for Groq and Google.
 */

import { OpenAIWhisperProvider } from './openai-whisper'
import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
  TranscriptionProviderType,
  TranscriptionConfig,
} from './types'

// Re-export types
export type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
  TranscriptionSegment,
  TranscriptionProviderType,
  TranscriptionConfig,
} from './types'

/**
 * Default provider type
 */
const DEFAULT_PROVIDER: TranscriptionProviderType = 'openai-whisper'

/**
 * Cached provider instance
 */
let cachedProvider: TranscriptionProvider | null = null
let cachedProviderType: TranscriptionProviderType | null = null

/**
 * Create a transcription provider based on the config
 */
function createProvider(config?: TranscriptionConfig): TranscriptionProvider {
  const providerType = config?.provider || DEFAULT_PROVIDER

  switch (providerType) {
    case 'openai-whisper':
      return new OpenAIWhisperProvider(config?.apiKey)

    case 'groq-whisper':
      // TODO: Implement Groq Whisper provider
      throw new Error('Groq Whisper provider not yet implemented')

    case 'google-speech':
      // TODO: Implement Google Speech-to-Text provider
      throw new Error('Google Speech-to-Text provider not yet implemented')

    default:
      throw new Error(`Unknown transcription provider: ${providerType}`)
  }
}

/**
 * Get the transcription provider (with caching)
 */
export function getTranscriptionProvider(config?: TranscriptionConfig): TranscriptionProvider {
  const providerType = config?.provider || DEFAULT_PROVIDER

  // Return cached provider if same type
  if (cachedProvider && cachedProviderType === providerType) {
    return cachedProvider
  }

  // Create and cache new provider
  cachedProvider = createProvider(config)
  cachedProviderType = providerType

  return cachedProvider
}

/**
 * Transcribe audio/video from a URL
 *
 * @param url - URL to the audio/video file
 * @param options - Transcription options
 * @param config - Provider configuration
 * @returns Transcription result
 */
export async function transcribeUrl(
  url: string,
  options?: TranscriptionOptions,
  config?: TranscriptionConfig
): Promise<TranscriptionResult> {
  const provider = getTranscriptionProvider(config)
  return provider.transcribeUrl(url, options)
}

/**
 * Transcribe audio/video from a buffer
 *
 * @param buffer - Audio/video file buffer
 * @param mimeType - MIME type of the file
 * @param options - Transcription options
 * @param config - Provider configuration
 * @returns Transcription result
 */
export async function transcribeBuffer(
  buffer: Buffer,
  mimeType: string,
  options?: TranscriptionOptions,
  config?: TranscriptionConfig
): Promise<TranscriptionResult> {
  const provider = getTranscriptionProvider(config)
  return provider.transcribeBuffer(buffer, mimeType, options)
}

/**
 * Check if transcription is available (API key configured)
 */
export function isTranscriptionAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}
