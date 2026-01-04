/**
 * Transcription Service Types
 *
 * Modular transcription system that can be easily swapped between providers:
 * - OpenAI Whisper (default)
 * - Groq Whisper (future)
 * - Google Speech-to-Text (future)
 */

/**
 * Result from a transcription operation
 */
export interface TranscriptionResult {
  /** Transcribed text content */
  text: string
  /** Auto-detected language code (e.g., 'en', 'es', 'ja') */
  language: string
  /** Duration of the audio in seconds */
  duration?: number
  /** Segments with timestamps for SRT/VTT generation */
  segments?: TranscriptionSegment[]
}

/**
 * A segment of transcribed text with timestamps
 */
export interface TranscriptionSegment {
  /** Start time in seconds */
  start: number
  /** End time in seconds */
  end: number
  /** Transcribed text for this segment */
  text: string
}

/**
 * Options for transcription
 */
export interface TranscriptionOptions {
  /** Hint for the expected language (optional, auto-detected if not provided) */
  languageHint?: string
  /** Response format preference */
  responseFormat?: 'json' | 'text' | 'srt' | 'vtt'
}

/**
 * Interface for transcription providers
 *
 * Implement this interface to add a new transcription provider.
 */
export interface TranscriptionProvider {
  /** Name of the provider for logging/debugging */
  name: string

  /**
   * Transcribe audio/video from a URL
   * Downloads the file and transcribes it
   *
   * @param url - URL to the audio/video file
   * @param options - Transcription options
   * @returns Transcription result
   */
  transcribeUrl(url: string, options?: TranscriptionOptions): Promise<TranscriptionResult>

  /**
   * Transcribe audio/video from a buffer
   *
   * @param buffer - Audio/video file buffer
   * @param mimeType - MIME type of the file (e.g., 'video/mp4', 'audio/mp3')
   * @param options - Transcription options
   * @returns Transcription result
   */
  transcribeBuffer(
    buffer: Buffer,
    mimeType: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>
}

/**
 * Supported transcription provider types
 */
export type TranscriptionProviderType = 'openai-whisper' | 'groq-whisper' | 'google-speech'

/**
 * Configuration for the transcription service
 */
export interface TranscriptionConfig {
  /** Which provider to use */
  provider: TranscriptionProviderType
  /** API key for the provider */
  apiKey?: string
}
