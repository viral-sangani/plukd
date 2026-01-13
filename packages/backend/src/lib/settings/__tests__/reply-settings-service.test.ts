import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ToneType } from '@plukd/shared'

/**
 * Mock Supabase before imports
 */
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { supabaseAdmin } from '../../../config/supabase'
import {
  getDefaultReplySettings,
  loadReplySettings,
  saveReplySettings,
  deleteReplySettings,
  getUserTonePrompts,
  getTonePrompt,
  createTonePrompt,
  updateTonePrompt,
  deleteTonePrompt,
  createReplyStat,
  updateReplyStat,
  getUserReplyStats,
  getReplyStatsSummary,
} from '../reply-settings-service'

/**
 * Test Fixtures
 */
const TEST_USER_ID = 'user-123'
const TEST_SETTINGS_ID = 'settings-123'
const TEST_TONE_PROMPT_ID = 'tone-123'
const TEST_REPLY_STAT_ID = 'stat-123'

const mockReplySettings = {
  id: TEST_SETTINGS_ID,
  user_id: TEST_USER_ID,
  enabled: true,
  default_tone: 'casual' as ToneType,
  include_emoji: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockTonePrompt = {
  id: TEST_TONE_PROMPT_ID,
  user_id: TEST_USER_ID,
  tone_type: 'witty' as ToneType,
  custom_prompt: 'Be witty and clever',
  temperature: 0.8,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockReplyStat = {
  id: TEST_REPLY_STAT_ID,
  user_id: TEST_USER_ID,
  tweet_url: 'https://twitter.com/user/status/123',
  tone_used: 'professional' as ToneType,
  generated_reply: 'Great insights!',
  was_sent: true,
  generation_time_ms: 1500,
  created_at: '2024-01-01T00:00:00Z',
}

/**
 * Mock Chain Builders
 */
function createSelectChain(data: unknown = null, error: unknown = null) {
  const chain = {
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data, error }),
    order: vi.fn(() => chain),
    range: vi.fn(() => ({
      then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
        resolve({ data, error }),
    })),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      resolve({ data, error }),
  }
  return chain
}

function createInsertChain(data: unknown = null, error: unknown = null) {
  return {
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data, error }),
    })),
  }
}

function createUpdateChain(data: unknown = null, error: unknown = null) {
  const chain = {
    eq: vi.fn(() => chain),
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data, error }),
    })),
  }
  return chain
}

function createDeleteChain(error: unknown = null) {
  const chain = {
    eq: vi.fn(() => chain),
    then: (resolve: (value: { error: unknown }) => void) => resolve({ error }),
  }
  return chain
}

function createCountChain(count: number | null = 0, error: unknown = null) {
  const chain = {
    eq: vi.fn(() => chain),
    then: (resolve: (value: { count: number | null; error: unknown }) => void) =>
      resolve({ count, error }),
  }
  return chain
}

/**
 * Test Suite: Reply Settings Service
 */
describe('Reply Settings Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test Suite: getDefaultReplySettings
   */
  describe('getDefaultReplySettings', () => {
    it('should return default settings with correct structure', () => {
      const result = getDefaultReplySettings(TEST_USER_ID)

      expect(result).toEqual({
        id: '',
        user_id: TEST_USER_ID,
        enabled: false,
        default_tone: 'casual',
        include_emoji: true,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      })
    })

    it('should set enabled to false by default', () => {
      const result = getDefaultReplySettings(TEST_USER_ID)
      expect(result.enabled).toBe(false)
    })

    it('should set default_tone to casual', () => {
      const result = getDefaultReplySettings(TEST_USER_ID)
      expect(result.default_tone).toBe('casual')
    })

    it('should set include_emoji to true', () => {
      const result = getDefaultReplySettings(TEST_USER_ID)
      expect(result.include_emoji).toBe(true)
    })

    it('should have valid ISO timestamps', () => {
      const result = getDefaultReplySettings(TEST_USER_ID)
      expect(new Date(result.created_at).toISOString()).toBe(result.created_at)
      expect(new Date(result.updated_at).toISOString()).toBe(result.updated_at)
    })

    it('should use provided user_id', () => {
      const customUserId = 'custom-user-789'
      const result = getDefaultReplySettings(customUserId)
      expect(result.user_id).toBe(customUserId)
    })
  })

  /**
   * Test Suite: loadReplySettings
   */
  describe('loadReplySettings', () => {
    it('should load existing settings successfully', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(mockReplySettings)),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await loadReplySettings(TEST_USER_ID)

      expect(mockFrom).toHaveBeenCalledWith('reply_settings')
      expect(result).toEqual(mockReplySettings)
    })

    it('should return default settings when none exist (PGRST116)', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() =>
          createSelectChain(null, { code: 'PGRST116', message: 'No rows found' })
        ),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await loadReplySettings(TEST_USER_ID)

      expect(result.user_id).toBe(TEST_USER_ID)
      expect(result.enabled).toBe(false)
      expect(result.default_tone).toBe('casual')
    })

    it('should filter by user_id', async () => {
      const selectChain = createSelectChain(mockReplySettings)
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await loadReplySettings(TEST_USER_ID)

      expect(selectChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should call single() to get one record', async () => {
      const selectChain = createSelectChain(mockReplySettings)
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await loadReplySettings(TEST_USER_ID)

      expect(selectChain.single).toHaveBeenCalled()
    })

    it('should throw error for database errors (non-PGRST116)', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() =>
          createSelectChain(null, { code: 'GENERIC_ERROR', message: 'Database error' })
        ),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(loadReplySettings(TEST_USER_ID)).rejects.toThrow(
        'Failed to load reply settings'
      )
    })

    it('should log error for non-PGRST116 errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error')
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null, { code: 'ERROR', message: 'DB Error' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(loadReplySettings(TEST_USER_ID)).rejects.toThrow()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(loadReplySettings(TEST_USER_ID)).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: saveReplySettings
   */
  describe('saveReplySettings', () => {
    it('should create new settings when none exist', async () => {
      const input = {
        enabled: true,
        default_tone: 'professional' as ToneType,
        include_emoji: false,
      }

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          // First call checks for existing
          if (callCount === 1) {
            return {
              select: vi.fn(() => createSelectChain(null)),
            }
          }
          // Second call inserts
          return {
            insert: vi.fn(() =>
              createInsertChain({ ...mockReplySettings, ...input, user_id: TEST_USER_ID })
            ),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await saveReplySettings(TEST_USER_ID, input)

      expect(result.enabled).toBe(true)
      expect(result.default_tone).toBe('professional')
      expect(result.include_emoji).toBe(false)
    })

    it('should update existing settings', async () => {
      const input = { enabled: false }
      const existingSettings = { id: TEST_SETTINGS_ID }

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          if (callCount === 1) {
            // First call - check existing
            return {
              select: vi.fn(() => createSelectChain(existingSettings)),
            }
          } else {
            // Second call - update
            return {
              update: vi.fn(() =>
                createUpdateChain({ ...mockReplySettings, enabled: false })
              ),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await saveReplySettings(TEST_USER_ID, input)

      expect(result.enabled).toBe(false)
    })

    it('should include user_id in insert', async () => {
      const input = { enabled: true }
      let capturedInsertData: unknown

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          if (callCount === 1) {
            return { select: vi.fn(() => createSelectChain(null)) }
          } else {
            return {
              insert: vi.fn((data: unknown) => {
                capturedInsertData = data
                return createInsertChain({ ...mockReplySettings, ...input })
              }),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await saveReplySettings(TEST_USER_ID, input)

      expect(capturedInsertData).toMatchObject({
        user_id: TEST_USER_ID,
        enabled: true,
      })
    })

    it('should filter update by user_id', async () => {
      const input = { enabled: true }
      const updateChain = createUpdateChain(mockReplySettings)

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          if (callCount === 1) {
            return {
              select: vi.fn(() => createSelectChain({ id: TEST_SETTINGS_ID })),
            }
          } else {
            return { update: vi.fn(() => updateChain) }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await saveReplySettings(TEST_USER_ID, input)

      expect(updateChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should throw error on insert failure', async () => {
      const input = { enabled: true }

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          if (callCount === 1) {
            return { select: vi.fn(() => createSelectChain(null)) }
          } else {
            return {
              insert: vi.fn(() => createInsertChain(null, { message: 'Insert failed' })),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(saveReplySettings(TEST_USER_ID, input)).rejects.toThrow(
        'Failed to create reply settings'
      )
    })

    it('should throw error on update failure', async () => {
      const input = { enabled: true }

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          if (callCount === 1) {
            return {
              select: vi.fn(() => createSelectChain({ id: TEST_SETTINGS_ID })),
            }
          } else {
            return {
              update: vi.fn(() => createUpdateChain(null, { message: 'Update failed' })),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(saveReplySettings(TEST_USER_ID, input)).rejects.toThrow(
        'Failed to update reply settings'
      )
    })

    it('should handle partial updates', async () => {
      const input = { include_emoji: false }

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_settings') {
          callCount++
          if (callCount === 1) {
            return {
              select: vi.fn(() => createSelectChain({ id: TEST_SETTINGS_ID })),
            }
          } else {
            return {
              update: vi.fn(() =>
                createUpdateChain({ ...mockReplySettings, include_emoji: false })
              ),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await saveReplySettings(TEST_USER_ID, input)

      expect(result.include_emoji).toBe(false)
      expect(result.enabled).toBe(true) // Other fields unchanged
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(saveReplySettings(TEST_USER_ID, {})).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: deleteReplySettings
   */
  describe('deleteReplySettings', () => {
    it('should delete settings successfully', async () => {
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => createDeleteChain(null)),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(deleteReplySettings(TEST_USER_ID)).resolves.not.toThrow()
      expect(mockFrom).toHaveBeenCalledWith('reply_settings')
    })

    it('should filter delete by user_id', async () => {
      const deleteChain = createDeleteChain(null)
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => deleteChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await deleteReplySettings(TEST_USER_ID)

      expect(deleteChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should throw error on delete failure', async () => {
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => createDeleteChain({ message: 'Delete failed' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(deleteReplySettings(TEST_USER_ID)).rejects.toThrow(
        'Failed to delete reply settings'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(deleteReplySettings(TEST_USER_ID)).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: getUserTonePrompts
   */
  describe('getUserTonePrompts', () => {
    it('should load all tone prompts for user', async () => {
      const mockPrompts = [mockTonePrompt, { ...mockTonePrompt, tone_type: 'professional' }]
      const selectChain = createSelectChain(mockPrompts)

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getUserTonePrompts(TEST_USER_ID)

      expect(result).toEqual(mockPrompts)
      expect(mockFrom).toHaveBeenCalledWith('tone_prompts')
    })

    it('should filter by user_id', async () => {
      const selectChain = createSelectChain([mockTonePrompt])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserTonePrompts(TEST_USER_ID)

      expect(selectChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should order by created_at ascending', async () => {
      const selectChain = createSelectChain([mockTonePrompt])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserTonePrompts(TEST_USER_ID)

      expect(selectChain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    })

    it('should return empty array when no prompts exist', async () => {
      const selectChain = createSelectChain(null)
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getUserTonePrompts(TEST_USER_ID)

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      const selectChain = createSelectChain(null, { message: 'Database error' })
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getUserTonePrompts(TEST_USER_ID)).rejects.toThrow(
        'Failed to load tone prompts'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getUserTonePrompts(TEST_USER_ID)).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: getTonePrompt
   */
  describe('getTonePrompt', () => {
    it('should load specific tone prompt', async () => {
      const selectChain = createSelectChain(mockTonePrompt)
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getTonePrompt(TEST_USER_ID, 'witty')

      expect(result).toEqual(mockTonePrompt)
    })

    it('should filter by user_id and tone_type', async () => {
      const selectChain = createSelectChain(mockTonePrompt)
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getTonePrompt(TEST_USER_ID, 'professional')

      expect(selectChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
      expect(selectChain.eq).toHaveBeenCalledWith('tone_type', 'professional')
    })

    it('should return null when prompt not found (PGRST116)', async () => {
      const selectChain = createSelectChain(null, { code: 'PGRST116' })
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getTonePrompt(TEST_USER_ID, 'witty')

      expect(result).toBeNull()
    })

    it('should throw error for non-PGRST116 errors', async () => {
      const selectChain = createSelectChain(null, { code: 'ERROR', message: 'Database error' })
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getTonePrompt(TEST_USER_ID, 'witty')).rejects.toThrow(
        'Failed to load tone prompt'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getTonePrompt(TEST_USER_ID, 'witty')).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: createTonePrompt
   */
  describe('createTonePrompt', () => {
    it('should create tone prompt successfully', async () => {
      const input = {
        tone_type: 'witty' as ToneType,
        custom_prompt: 'Be clever and witty',
        temperature: 0.8,
      }

      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => createInsertChain(mockTonePrompt)),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await createTonePrompt(TEST_USER_ID, input)

      expect(result).toEqual(mockTonePrompt)
      expect(mockFrom).toHaveBeenCalledWith('tone_prompts')
    })

    it('should include user_id in insert', async () => {
      const input = {
        tone_type: 'casual' as ToneType,
        custom_prompt: 'Be casual',
      }

      let capturedData: unknown
      const mockFrom = vi.fn(() => ({
        insert: vi.fn((data: unknown) => {
          capturedData = data
          return createInsertChain(mockTonePrompt)
        }),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await createTonePrompt(TEST_USER_ID, input)

      expect(capturedData).toMatchObject({
        user_id: TEST_USER_ID,
        tone_type: 'casual',
        custom_prompt: 'Be casual',
      })
    })

    it('should use default temperature 0.7 when not provided', async () => {
      const input = {
        tone_type: 'professional' as ToneType,
        custom_prompt: 'Be professional',
      }

      let capturedData: unknown
      const mockFrom = vi.fn(() => ({
        insert: vi.fn((data: unknown) => {
          capturedData = data
          return createInsertChain(mockTonePrompt)
        }),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await createTonePrompt(TEST_USER_ID, input)

      expect(capturedData).toMatchObject({
        temperature: 0.7,
      })
    })

    it('should use provided temperature when specified', async () => {
      const input = {
        tone_type: 'witty' as ToneType,
        custom_prompt: 'Be witty',
        temperature: 0.9,
      }

      let capturedData: unknown
      const mockFrom = vi.fn(() => ({
        insert: vi.fn((data: unknown) => {
          capturedData = data
          return createInsertChain(mockTonePrompt)
        }),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await createTonePrompt(TEST_USER_ID, input)

      expect(capturedData).toMatchObject({
        temperature: 0.9,
      })
    })

    it('should throw error on insert failure', async () => {
      const input = {
        tone_type: 'casual' as ToneType,
        custom_prompt: 'Be casual',
      }

      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => createInsertChain(null, { message: 'Insert failed' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(createTonePrompt(TEST_USER_ID, input)).rejects.toThrow(
        'Failed to create tone prompt'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const input = {
        tone_type: 'casual' as ToneType,
        custom_prompt: 'Be casual',
      }

      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(createTonePrompt(TEST_USER_ID, input)).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: updateTonePrompt
   */
  describe('updateTonePrompt', () => {
    it('should update tone prompt successfully', async () => {
      const input = { custom_prompt: 'Updated prompt' }
      const updateChain = createUpdateChain({ ...mockTonePrompt, ...input })

      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await updateTonePrompt(TEST_USER_ID, 'witty', input)

      expect(result.custom_prompt).toBe('Updated prompt')
    })

    it('should filter by user_id and tone_type', async () => {
      const input = { temperature: 0.6 }
      const updateChain = createUpdateChain(mockTonePrompt)

      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await updateTonePrompt(TEST_USER_ID, 'professional', input)

      expect(updateChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
      expect(updateChain.eq).toHaveBeenCalledWith('tone_type', 'professional')
    })

    it('should handle partial updates', async () => {
      const input = { temperature: 0.5 }
      const updateChain = createUpdateChain({ ...mockTonePrompt, temperature: 0.5 })

      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await updateTonePrompt(TEST_USER_ID, 'witty', input)

      expect(result.temperature).toBe(0.5)
      expect(result.custom_prompt).toBe(mockTonePrompt.custom_prompt) // Unchanged
    })

    it('should throw error on update failure', async () => {
      const input = { custom_prompt: 'New prompt' }
      const updateChain = createUpdateChain(null, { message: 'Update failed' })

      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(updateTonePrompt(TEST_USER_ID, 'witty', input)).rejects.toThrow(
        'Failed to update tone prompt'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const input = { custom_prompt: 'New prompt' }
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(updateTonePrompt(TEST_USER_ID, 'witty', input)).rejects.toThrow(
        'Unexpected error'
      )
    })
  })

  /**
   * Test Suite: deleteTonePrompt
   */
  describe('deleteTonePrompt', () => {
    it('should delete tone prompt successfully', async () => {
      const deleteChain = createDeleteChain(null)
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => deleteChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(deleteTonePrompt(TEST_USER_ID, 'witty')).resolves.not.toThrow()
      expect(mockFrom).toHaveBeenCalledWith('tone_prompts')
    })

    it('should filter by user_id and tone_type', async () => {
      const deleteChain = createDeleteChain(null)
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => deleteChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await deleteTonePrompt(TEST_USER_ID, 'professional')

      expect(deleteChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
      expect(deleteChain.eq).toHaveBeenCalledWith('tone_type', 'professional')
    })

    it('should throw error on delete failure', async () => {
      const deleteChain = createDeleteChain({ message: 'Delete failed' })
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => deleteChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(deleteTonePrompt(TEST_USER_ID, 'witty')).rejects.toThrow(
        'Failed to delete tone prompt'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(deleteTonePrompt(TEST_USER_ID, 'witty')).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: createReplyStat
   */
  describe('createReplyStat', () => {
    it('should create reply stat successfully', async () => {
      const input = {
        tweet_url: 'https://twitter.com/user/status/123',
        tone_used: 'professional' as ToneType,
        generated_reply: 'Great insights!',
        was_sent: true,
        generation_time_ms: 1500,
      }

      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => createInsertChain(mockReplyStat)),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await createReplyStat(TEST_USER_ID, input)

      expect(result).toEqual(mockReplyStat)
      expect(mockFrom).toHaveBeenCalledWith('reply_generation_stats')
    })

    it('should include user_id in insert', async () => {
      const input = {
        tweet_url: 'https://twitter.com/user/status/456',
        tone_used: 'casual' as ToneType,
        generated_reply: 'Nice!',
      }

      let capturedData: unknown
      const mockFrom = vi.fn(() => ({
        insert: vi.fn((data: unknown) => {
          capturedData = data
          return createInsertChain(mockReplyStat)
        }),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await createReplyStat(TEST_USER_ID, input)

      expect(capturedData).toMatchObject({
        user_id: TEST_USER_ID,
        tweet_url: input.tweet_url,
        tone_used: input.tone_used,
        generated_reply: input.generated_reply,
      })
    })

    it('should default was_sent to false when not provided', async () => {
      const input = {
        tweet_url: 'https://twitter.com/user/status/789',
        tone_used: 'witty' as ToneType,
        generated_reply: 'Clever reply',
      }

      let capturedData: unknown
      const mockFrom = vi.fn(() => ({
        insert: vi.fn((data: unknown) => {
          capturedData = data
          return createInsertChain(mockReplyStat)
        }),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await createReplyStat(TEST_USER_ID, input)

      expect(capturedData).toMatchObject({
        was_sent: false,
      })
    })

    it('should default generation_time_ms to null when not provided', async () => {
      const input = {
        tweet_url: 'https://twitter.com/user/status/789',
        tone_used: 'supportive' as ToneType,
        generated_reply: 'Supportive reply',
      }

      let capturedData: unknown
      const mockFrom = vi.fn(() => ({
        insert: vi.fn((data: unknown) => {
          capturedData = data
          return createInsertChain(mockReplyStat)
        }),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await createReplyStat(TEST_USER_ID, input)

      expect(capturedData).toMatchObject({
        generation_time_ms: null,
      })
    })

    it('should throw error on insert failure', async () => {
      const input = {
        tweet_url: 'https://twitter.com/user/status/123',
        tone_used: 'casual' as ToneType,
        generated_reply: 'Reply',
      }

      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => createInsertChain(null, { message: 'Insert failed' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(createReplyStat(TEST_USER_ID, input)).rejects.toThrow(
        'Failed to create reply generation stat'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const input = {
        tweet_url: 'https://twitter.com/user/status/123',
        tone_used: 'casual' as ToneType,
        generated_reply: 'Reply',
      }

      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(createReplyStat(TEST_USER_ID, input)).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: updateReplyStat
   */
  describe('updateReplyStat', () => {
    it('should update reply stat was_sent to true', async () => {
      const updateChain = createUpdateChain({ ...mockReplyStat, was_sent: true })
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await updateReplyStat(TEST_REPLY_STAT_ID, TEST_USER_ID, true)

      expect(result.was_sent).toBe(true)
    })

    it('should update reply stat was_sent to false', async () => {
      const updateChain = createUpdateChain({ ...mockReplyStat, was_sent: false })
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await updateReplyStat(TEST_REPLY_STAT_ID, TEST_USER_ID, false)

      expect(result.was_sent).toBe(false)
    })

    it('should filter by stat id and user_id', async () => {
      const updateChain = createUpdateChain(mockReplyStat)
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await updateReplyStat(TEST_REPLY_STAT_ID, TEST_USER_ID, true)

      expect(updateChain.eq).toHaveBeenCalledWith('id', TEST_REPLY_STAT_ID)
      expect(updateChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should throw error on update failure', async () => {
      const updateChain = createUpdateChain(null, { message: 'Update failed' })
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => updateChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(updateReplyStat(TEST_REPLY_STAT_ID, TEST_USER_ID, true)).rejects.toThrow(
        'Failed to update reply generation stat'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(updateReplyStat(TEST_REPLY_STAT_ID, TEST_USER_ID, true)).rejects.toThrow(
        'Unexpected error'
      )
    })
  })

  /**
   * Test Suite: getUserReplyStats
   */
  describe('getUserReplyStats', () => {
    it('should load reply stats with default pagination', async () => {
      const mockStats = [mockReplyStat, { ...mockReplyStat, id: 'stat-456' }]
      const selectChain = createSelectChain(mockStats)

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getUserReplyStats(TEST_USER_ID)

      expect(result).toEqual(mockStats)
      expect(mockFrom).toHaveBeenCalledWith('reply_generation_stats')
    })

    it('should filter by user_id', async () => {
      const selectChain = createSelectChain([mockReplyStat])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserReplyStats(TEST_USER_ID)

      expect(selectChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should order by created_at descending', async () => {
      const selectChain = createSelectChain([mockReplyStat])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserReplyStats(TEST_USER_ID)

      expect(selectChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('should use default limit of 50', async () => {
      const selectChain = createSelectChain([mockReplyStat])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserReplyStats(TEST_USER_ID)

      expect(selectChain.range).toHaveBeenCalledWith(0, 49)
    })

    it('should use custom limit', async () => {
      const selectChain = createSelectChain([mockReplyStat])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserReplyStats(TEST_USER_ID, 10)

      expect(selectChain.range).toHaveBeenCalledWith(0, 9)
    })

    it('should use custom offset', async () => {
      const selectChain = createSelectChain([mockReplyStat])
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getUserReplyStats(TEST_USER_ID, 20, 40)

      expect(selectChain.range).toHaveBeenCalledWith(40, 59)
    })

    it('should return empty array when no stats exist', async () => {
      const selectChain = createSelectChain(null)
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getUserReplyStats(TEST_USER_ID)

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      const selectChain = createSelectChain(null, { message: 'Database error' })
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => selectChain),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getUserReplyStats(TEST_USER_ID)).rejects.toThrow(
        'Failed to load reply generation stats'
      )
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getUserReplyStats(TEST_USER_ID)).rejects.toThrow('Unexpected error')
    })
  })

  /**
   * Test Suite: getReplyStatsSummary
   */
  describe('getReplyStatsSummary', () => {
    it('should return summary with all counts', async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          // Create different response for each call
          const callCount = mockFrom.mock.calls.filter((c) => c[0] === 'reply_generation_stats')
            .length

          if (callCount === 1) {
            // First call: total count
            return {
              select: vi.fn(() => createCountChain(10)),
            }
          } else if (callCount === 2) {
            // Second call: sent count
            return {
              select: vi.fn(() => createCountChain(7)),
            }
          } else {
            // Third call: tone data
            return {
              select: vi.fn(() =>
                createSelectChain([
                  { tone_used: 'professional' },
                  { tone_used: 'professional' },
                  { tone_used: 'casual' },
                  { tone_used: 'witty' },
                  { tone_used: 'witty' },
                  { tone_used: 'witty' },
                ])
              ),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getReplyStatsSummary(TEST_USER_ID)

      expect(result).toEqual({
        total_generated: 10,
        total_sent: 7,
        by_tone: {
          professional: 2,
          casual: 1,
          witty: 3,
        },
      })
    })

    it('should return zero counts when no stats exist', async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          const callCount = mockFrom.mock.calls.filter((c) => c[0] === 'reply_generation_stats')
            .length

          if (callCount <= 2) {
            return { select: vi.fn(() => createCountChain(0)) }
          } else {
            return { select: vi.fn(() => createSelectChain([])) }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getReplyStatsSummary(TEST_USER_ID)

      expect(result).toEqual({
        total_generated: 0,
        total_sent: 0,
        by_tone: {},
      })
    })

    it('should filter by user_id for all queries', async () => {
      const countChain1 = createCountChain(5)
      const countChain2 = createCountChain(3)
      const selectChain = createSelectChain([{ tone_used: 'casual' }])

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          callCount++
          if (callCount === 1) {
            return { select: vi.fn(() => countChain1) }
          } else if (callCount === 2) {
            return { select: vi.fn(() => countChain2) }
          } else {
            return { select: vi.fn(() => selectChain) }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getReplyStatsSummary(TEST_USER_ID)

      expect(countChain1.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
      expect(countChain2.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
      expect(selectChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should filter sent count by was_sent=true', async () => {
      const countChain1 = createCountChain(10)
      const countChain2 = createCountChain(6)
      const selectChain = createSelectChain([])

      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          callCount++
          if (callCount === 1) {
            return { select: vi.fn(() => countChain1) }
          } else if (callCount === 2) {
            return { select: vi.fn(() => countChain2) }
          } else {
            return { select: vi.fn(() => selectChain) }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await getReplyStatsSummary(TEST_USER_ID)

      expect(countChain2.eq).toHaveBeenCalledWith('was_sent', true)
    })

    it('should throw error on total count failure', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createCountChain(null, { message: 'Count error' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getReplyStatsSummary(TEST_USER_ID)).rejects.toThrow(
        'Failed to get reply stats summary'
      )
    })

    it('should throw error on sent count failure', async () => {
      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          callCount++
          if (callCount === 1) {
            return { select: vi.fn(() => createCountChain(10)) }
          } else {
            return { select: vi.fn(() => createCountChain(null, { message: 'Count error' })) }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getReplyStatsSummary(TEST_USER_ID)).rejects.toThrow(
        'Failed to get reply stats summary'
      )
    })

    it('should throw error on tone data failure', async () => {
      let callCount = 0
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          callCount++
          if (callCount <= 2) {
            return { select: vi.fn(() => createCountChain(5)) }
          } else {
            return {
              select: vi.fn(() => createSelectChain(null, { message: 'Select error' })),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getReplyStatsSummary(TEST_USER_ID)).rejects.toThrow(
        'Failed to get reply stats summary'
      )
    })

    it('should handle multiple tones correctly', async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === 'reply_generation_stats') {
          const callCount = mockFrom.mock.calls.filter((c) => c[0] === 'reply_generation_stats')
            .length

          if (callCount <= 2) {
            return { select: vi.fn(() => createCountChain(8)) }
          } else {
            return {
              select: vi.fn(() =>
                createSelectChain([
                  { tone_used: 'professional' },
                  { tone_used: 'casual' },
                  { tone_used: 'witty' },
                  { tone_used: 'thoughtful' },
                  { tone_used: 'supportive' },
                  { tone_used: 'custom' },
                  { tone_used: 'professional' },
                  { tone_used: 'casual' },
                ])
              ),
            }
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      const result = await getReplyStatsSummary(TEST_USER_ID)

      expect(result.by_tone).toEqual({
        professional: 2,
        casual: 2,
        witty: 1,
        thoughtful: 1,
        supportive: 1,
        custom: 1,
      })
    })

    it('should handle unexpected exceptions', async () => {
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom)

      await expect(getReplyStatsSummary(TEST_USER_ID)).rejects.toThrow('Unexpected error')
    })
  })
})
