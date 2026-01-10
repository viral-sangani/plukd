/**
 * Tone Manager Service
 * Manages tone configurations for AI reply generation
 * Simplified to 3 core tones: casual, professional, humorous
 */

export type ToneType = 'casual' | 'professional' | 'humorous'

export interface ToneConfig {
  description: string
  examples: string[]
  temperature: number
}

/**
 * Simplified tone prompts focusing on the 3 most useful tones
 */
export const TONE_PROMPTS: Record<ToneType, ToneConfig> = {
  casual: {
    description:
      'Friendly, conversational friend - natural contractions, relaxed tone, genuine reactions',
    temperature: 0.85,
    examples: [
      "Original: 'Just shipped a new feature!'\nReply: 'ooh what's the feature? been following your project and this looks sick'",
      "Original: 'Why does debugging always take longer than expected?'\nReply: 'lol every time. spent 3 hours yesterday on a typo... found it at 2am 😅'",
    ],
  },
  professional: {
    description:
      'Business-appropriate but warm - clear, concise, respectful yet conversational',
    temperature: 0.65,
    examples: [
      "Original: 'Excited to announce our Series A!'\nReply: 'Congratulations on the milestone. What area are you most excited to invest in with this round?'",
      "Original: 'Remote work is killing company culture'\nReply: 'Interesting take. What specific cultural elements have you found most challenging to maintain remotely?'",
    ],
  },
  humorous: {
    description:
      'Witty and playful - light jokes, clever wordplay, self-aware humor without forcing it',
    temperature: 0.9,
    examples: [
      "Original: 'My code works but I don't know why'\nReply: 'the best kind of code. now don't touch it and nobody gets hurt'",
      "Original: 'Just spent 2 hours optimizing something that saves 2ms'\nReply: 'but those 2ms will compound over 10 billion requests and save you like... $3'",
    ],
  },
}

export const TONE_LABELS: Record<ToneType, string> = {
  casual: 'Casual',
  professional: 'Professional',
  humorous: 'Humorous',
}

/**
 * Get tone configuration by tone type
 * @param tone - The tone type to retrieve
 * @returns The tone configuration
 */
export function getToneConfig(tone: ToneType): ToneConfig {
  return TONE_PROMPTS[tone]
}

/**
 * Get all available tones
 * @returns Array of tone types with their labels
 */
export function getAvailableTones(): Array<{ value: ToneType; label: string }> {
  return (Object.keys(TONE_PROMPTS) as ToneType[]).map((tone) => ({
    value: tone,
    label: TONE_LABELS[tone],
  }))
}

/**
 * Validate tone type
 * @param tone - The tone to validate
 * @returns True if the tone is valid
 */
export function isValidTone(tone: string): tone is ToneType {
  return tone in TONE_PROMPTS
}
