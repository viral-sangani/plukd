// Reply generation types

export type ToneType =
  | 'professional'
  | 'casual'
  | 'witty'
  | 'thoughtful'
  | 'supportive'
  | 'custom'

export interface ReplySettings {
  id: string
  user_id: string
  enabled: boolean
  default_tone: ToneType
  include_emoji: boolean
  created_at: string
  updated_at: string
}

export interface TonePrompt {
  id: string
  user_id: string
  tone_type: ToneType
  custom_prompt: string
  temperature: number // 0.0 - 1.0
  created_at: string
  updated_at: string
}

export interface ReplyGenerationStat {
  id: string
  user_id: string
  tweet_url: string
  tone_used: ToneType
  generated_reply: string
  was_sent: boolean
  generation_time_ms: number | null
  created_at: string
}

// Input types for API requests
export interface CreateReplySettingsInput {
  enabled?: boolean
  default_tone?: ToneType
  include_emoji?: boolean
}

export interface UpdateReplySettingsInput {
  enabled?: boolean
  default_tone?: ToneType
  include_emoji?: boolean
}

export interface CreateTonePromptInput {
  tone_type: ToneType
  custom_prompt: string
  temperature?: number
}

export interface UpdateTonePromptInput {
  custom_prompt?: string
  temperature?: number
}

export interface CreateReplyStatInput {
  tweet_url: string
  tone_used: ToneType
  generated_reply: string
  was_sent?: boolean
  generation_time_ms?: number
}

// Tweet context for reply generation
export interface TweetContext {
  tweet_url: string
  tweet_text: string
  author_handle: string
  author_name?: string
  is_thread?: boolean
  thread_context?: string[]
  engagement?: {
    likes?: number
    retweets?: number
    replies?: number
  }
  timestamp?: string
}

// Reply generation request
export interface GenerateReplyRequest {
  context: TweetContext
  tone?: ToneType
  include_emoji?: boolean
  custom_instructions?: string
}

// Reply generation response
export interface GenerateReplyResponse {
  reply: string
  tone_used: ToneType
  generation_time_ms: number
  suggestions?: string[] // Alternative reply options
}
