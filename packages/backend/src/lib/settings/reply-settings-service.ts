import { supabaseAdmin } from '../../config/supabase'
import type {
  ReplySettings,
  TonePrompt,
  ToneType,
  CreateReplySettingsInput,
  UpdateReplySettingsInput,
  CreateTonePromptInput,
  UpdateTonePromptInput,
  CreateReplyStatInput,
  ReplyGenerationStat,
} from '@plukd/shared'

// ============================================================================
// REPLY SETTINGS OPERATIONS
// ============================================================================

/**
 * Get default reply settings for a user
 */
export function getDefaultReplySettings(userId: string): ReplySettings {
  return {
    id: '',
    user_id: userId,
    enabled: false,
    default_tone: 'casual',
    include_emoji: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Load reply settings for a user
 * Returns default settings if none exist
 */
export async function loadReplySettings(userId: string): Promise<ReplySettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reply_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If no settings exist, return defaults
      if (error.code === 'PGRST116') {
        return getDefaultReplySettings(userId)
      }
      console.error('[reply-settings] Error loading settings:', error)
      throw new Error('Failed to load reply settings')
    }

    return data
  } catch (error) {
    console.error('[reply-settings] Error in loadReplySettings:', error)
    throw error
  }
}

/**
 * Create or update reply settings for a user
 */
export async function saveReplySettings(
  userId: string,
  input: CreateReplySettingsInput | UpdateReplySettingsInput
): Promise<ReplySettings> {
  try {
    // Check if settings already exist
    const { data: existing } = await supabaseAdmin
      .from('reply_settings')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Update existing settings
      const { data, error } = await supabaseAdmin
        .from('reply_settings')
        .update(input)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[reply-settings] Error updating settings:', error)
        throw new Error('Failed to update reply settings')
      }

      return data
    } else {
      // Create new settings
      const { data, error } = await supabaseAdmin
        .from('reply_settings')
        .insert({
          user_id: userId,
          ...input,
        })
        .select()
        .single()

      if (error) {
        console.error('[reply-settings] Error creating settings:', error)
        throw new Error('Failed to create reply settings')
      }

      return data
    }
  } catch (error) {
    console.error('[reply-settings] Error in saveReplySettings:', error)
    throw error
  }
}

/**
 * Delete reply settings for a user
 */
export async function deleteReplySettings(userId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('reply_settings')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('[reply-settings] Error deleting settings:', error)
      throw new Error('Failed to delete reply settings')
    }
  } catch (error) {
    console.error('[reply-settings] Error in deleteReplySettings:', error)
    throw error
  }
}

// ============================================================================
// TONE PROMPTS OPERATIONS
// ============================================================================

/**
 * Get all tone prompts for a user
 */
export async function getUserTonePrompts(userId: string): Promise<TonePrompt[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tone_prompts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[reply-settings] Error loading tone prompts:', error)
      throw new Error('Failed to load tone prompts')
    }

    return data || []
  } catch (error) {
    console.error('[reply-settings] Error in getUserTonePrompts:', error)
    throw error
  }
}

/**
 * Get a specific tone prompt for a user
 */
export async function getTonePrompt(
  userId: string,
  toneType: ToneType
): Promise<TonePrompt | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tone_prompts')
      .select('*')
      .eq('user_id', userId)
      .eq('tone_type', toneType)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[reply-settings] Error loading tone prompt:', error)
      throw new Error('Failed to load tone prompt')
    }

    return data
  } catch (error) {
    console.error('[reply-settings] Error in getTonePrompt:', error)
    throw error
  }
}

/**
 * Create a new tone prompt for a user
 */
export async function createTonePrompt(
  userId: string,
  input: CreateTonePromptInput
): Promise<TonePrompt> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tone_prompts')
      .insert({
        user_id: userId,
        tone_type: input.tone_type,
        custom_prompt: input.custom_prompt,
        temperature: input.temperature ?? 0.7,
      })
      .select()
      .single()

    if (error) {
      console.error('[reply-settings] Error creating tone prompt:', error)
      throw new Error('Failed to create tone prompt')
    }

    return data
  } catch (error) {
    console.error('[reply-settings] Error in createTonePrompt:', error)
    throw error
  }
}

/**
 * Update an existing tone prompt
 */
export async function updateTonePrompt(
  userId: string,
  toneType: ToneType,
  input: UpdateTonePromptInput
): Promise<TonePrompt> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tone_prompts')
      .update(input)
      .eq('user_id', userId)
      .eq('tone_type', toneType)
      .select()
      .single()

    if (error) {
      console.error('[reply-settings] Error updating tone prompt:', error)
      throw new Error('Failed to update tone prompt')
    }

    return data
  } catch (error) {
    console.error('[reply-settings] Error in updateTonePrompt:', error)
    throw error
  }
}

/**
 * Delete a tone prompt
 */
export async function deleteTonePrompt(userId: string, toneType: ToneType): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('tone_prompts')
      .delete()
      .eq('user_id', userId)
      .eq('tone_type', toneType)

    if (error) {
      console.error('[reply-settings] Error deleting tone prompt:', error)
      throw new Error('Failed to delete tone prompt')
    }
  } catch (error) {
    console.error('[reply-settings] Error in deleteTonePrompt:', error)
    throw error
  }
}

// ============================================================================
// REPLY GENERATION STATS OPERATIONS
// ============================================================================

/**
 * Create a new reply generation stat entry
 */
export async function createReplyStat(
  userId: string,
  input: CreateReplyStatInput
): Promise<ReplyGenerationStat> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reply_generation_stats')
      .insert({
        user_id: userId,
        tweet_url: input.tweet_url,
        tone_used: input.tone_used,
        generated_reply: input.generated_reply,
        was_sent: input.was_sent ?? false,
        generation_time_ms: input.generation_time_ms ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[reply-settings] Error creating reply stat:', error)
      throw new Error('Failed to create reply generation stat')
    }

    return data
  } catch (error) {
    console.error('[reply-settings] Error in createReplyStat:', error)
    throw error
  }
}

/**
 * Update a reply stat (e.g., mark as sent)
 */
export async function updateReplyStat(
  statId: string,
  userId: string,
  wasSent: boolean
): Promise<ReplyGenerationStat> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reply_generation_stats')
      .update({ was_sent: wasSent })
      .eq('id', statId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[reply-settings] Error updating reply stat:', error)
      throw new Error('Failed to update reply generation stat')
    }

    return data
  } catch (error) {
    console.error('[reply-settings] Error in updateReplyStat:', error)
    throw error
  }
}

/**
 * Get reply generation stats for a user
 */
export async function getUserReplyStats(
  userId: string,
  limit = 50,
  offset = 0
): Promise<ReplyGenerationStat[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reply_generation_stats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[reply-settings] Error loading reply stats:', error)
      throw new Error('Failed to load reply generation stats')
    }

    return data || []
  } catch (error) {
    console.error('[reply-settings] Error in getUserReplyStats:', error)
    throw error
  }
}

/**
 * Get reply generation stats summary for a user
 */
export async function getReplyStatsSummary(userId: string): Promise<{
  total_generated: number
  total_sent: number
  by_tone: Record<ToneType, number>
}> {
  try {
    // Get total count and sent count
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('reply_generation_stats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      console.error('[reply-settings] Error counting reply stats:', countError)
      throw new Error('Failed to get reply stats summary')
    }

    const { count: sentCount, error: sentError } = await supabaseAdmin
      .from('reply_generation_stats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('was_sent', true)

    if (sentError) {
      console.error('[reply-settings] Error counting sent replies:', sentError)
      throw new Error('Failed to get reply stats summary')
    }

    // Get stats by tone
    const { data: toneData, error: toneError } = await supabaseAdmin
      .from('reply_generation_stats')
      .select('tone_used')
      .eq('user_id', userId)

    if (toneError) {
      console.error('[reply-settings] Error loading tone stats:', toneError)
      throw new Error('Failed to get reply stats summary')
    }

    // Count by tone
    const byTone: Record<string, number> = {}
    toneData?.forEach((stat) => {
      byTone[stat.tone_used] = (byTone[stat.tone_used] || 0) + 1
    })

    return {
      total_generated: totalCount || 0,
      total_sent: sentCount || 0,
      by_tone: byTone as Record<ToneType, number>,
    }
  } catch (error) {
    console.error('[reply-settings] Error in getReplyStatsSummary:', error)
    throw error
  }
}
