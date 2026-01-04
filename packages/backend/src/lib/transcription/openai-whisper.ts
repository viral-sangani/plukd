/**
 * OpenAI Whisper Transcription Provider
 *
 * Uses OpenAI's Whisper API for audio/video transcription.
 * Supports 50+ languages with auto-detection.
 *
 * API: https://platform.openai.com/docs/guides/speech-to-text
 * Model: whisper-1
 * Cost: ~$0.006/minute
 * Max file size: 25MB
 */

import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
  TranscriptionSegment,
} from './types'

/**
 * OpenAI Whisper API response format (verbose_json)
 */
interface WhisperResponse {
  task: string
  language: string
  duration: number
  text: string
  segments?: Array<{
    id: number
    seek: number
    start: number
    end: number
    text: string
    tokens: number[]
    temperature: number
    avg_logprob: number
    compression_ratio: number
    no_speech_prob: number
  }>
}

/**
 * Get MIME type extension for file naming
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/mpeg': 'mpeg',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
  }
  return mimeToExt[mimeType] || 'mp4'
}

/**
 * OpenAI Whisper transcription provider
 */
export class OpenAIWhisperProvider implements TranscriptionProvider {
  name = 'openai-whisper'
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    if (!this.apiKey) {
      console.warn('[openai-whisper] No API key provided. Transcription will fail.')
    }
  }

  /**
   * Transcribe audio/video from a URL
   */
  async transcribeUrl(url: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    console.log(`[openai-whisper] Downloading video from: ${url}`)

    // Download the file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'video/mp4'
    const buffer = Buffer.from(await response.arrayBuffer())

    console.log(`[openai-whisper] Downloaded ${buffer.length} bytes, type: ${contentType}`)

    return this.transcribeBuffer(buffer, contentType, options)
  }

  /**
   * Transcribe audio/video from a buffer
   */
  async transcribeBuffer(
    buffer: Buffer,
    mimeType: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Check file size (25MB limit)
    const maxSize = 25 * 1024 * 1024
    if (buffer.length > maxSize) {
      throw new Error(`File too large: ${buffer.length} bytes (max ${maxSize} bytes)`)
    }

    console.log(`[openai-whisper] Transcribing ${buffer.length} bytes, type: ${mimeType}`)

    // Create form data
    const ext = getExtensionFromMimeType(mimeType)
    const blob = new Blob([buffer], { type: mimeType })
    const formData = new FormData()
    formData.append('file', blob, `audio.${ext}`)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')

    if (options?.languageHint) {
      formData.append('language', options.languageHint)
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key')
      } else if (response.status === 413) {
        throw new Error('File too large for OpenAI Whisper (max 25MB)')
      } else if (response.status === 429) {
        throw new Error('OpenAI rate limit exceeded')
      }
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as WhisperResponse

    console.log(
      `[openai-whisper] Transcription complete: ${result.text.length} chars, language: ${result.language}, duration: ${result.duration}s`
    )
    console.log(`[openai-whisper] Segments count: ${result.segments?.length || 0}`)
    console.log(`[openai-whisper] Full transcript:\n---START TRANSCRIPT---\n${result.text}\n---END TRANSCRIPT---`)

    // Convert segments to our format
    const segments: TranscriptionSegment[] | undefined = result.segments?.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }))

    return {
      text: result.text,
      language: result.language,
      duration: result.duration,
      segments,
    }
  }
}
