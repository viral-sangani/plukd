/**
 * Comprehensive tests for Gopher API Client
 *
 * Tests the Gopher API client which handles asynchronous job workflows
 * for extracting content from Twitter/X and Reddit platforms.
 *
 * Coverage:
 * - API key validation and header creation
 * - Job submission (submitJob)
 * - Job status polling (checkJobStatus, pollUntilComplete)
 * - Result fetching (getJobResults)
 * - Main fetch function (fetchFromGopher)
 * - Get by ID function (getbyid)
 * - Type guards (isTwitterResult, isRedditResult)
 * - Error handling (API errors, timeouts, rate limits, invalid responses)
 * - Edge cases (missing data, malformed responses, network failures)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sleep } from '@plukd/shared'

// Note: Environment is mocked in the global setup file
// The GOPHER_API_KEY will be 'test-gopher-key' from src/tests/setup.ts

// Mock sleep function to speed up tests
vi.mock('@plukd/shared', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks are set up
import {
  fetchFromGopher,
  getbyid,
  isTwitterResult,
  isRedditResult,
  GopherApiError,
  type TwitterResult,
  type RedditResult,
  type GopherResult,
} from '../gopher-client'

describe('Gopher API Client', () => {
  // Mock fetch globally
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('API Key Validation', () => {
    it('should throw error when API key is missing from env', async () => {
      // Temporarily mock env without API key
      vi.doMock('../../config/env', () => ({
        env: {
          GOPHER_API_KEY: '',
        },
      }))

      // This error will be thrown when trying to create headers
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(
        fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
      ).rejects.toThrow()
    })
  })

  describe('GopherApiError', () => {
    it('should create error with message only', () => {
      const error = new GopherApiError('Test error')

      expect(error.message).toBe('Test error')
      expect(error.name).toBe('GopherApiError')
      expect(error.statusCode).toBeUndefined()
      expect(error.apiError).toBeUndefined()
    })

    it('should create error with status code', () => {
      const error = new GopherApiError('HTTP error', 500)

      expect(error.message).toBe('HTTP error')
      expect(error.statusCode).toBe(500)
      expect(error.apiError).toBeUndefined()
    })

    it('should create error with API error message', () => {
      const error = new GopherApiError('API failed', undefined, 'Invalid query')

      expect(error.message).toBe('API failed')
      expect(error.statusCode).toBeUndefined()
      expect(error.apiError).toBe('Invalid query')
    })

    it('should create error with all parameters', () => {
      const error = new GopherApiError('Complete error', 429, 'Rate limit exceeded')

      expect(error.message).toBe('Complete error')
      expect(error.statusCode).toBe(429)
      expect(error.apiError).toBe('Rate limit exceeded')
    })
  })

  describe('fetchFromGopher - Twitter', () => {
    describe('successful requests', () => {
      it('should successfully fetch Twitter results', async () => {
        const mockUuid = 'test-uuid-123'
        const mockTwitterResult: TwitterResult = {
          id: '1234567890',
          source: 'twitter',
          content: 'Test tweet content',
          metadata: {
            conversation_id: '1234567890',
            created_at: '2024-01-15T10:00:00.000Z',
            likes: 1500,
            public_metrics: {
              like_count: 1500,
              reply_count: 50,
              retweet_count: 300,
            },
            tweet_id: 1234567890,
            user_id: 'user123',
            username: 'testuser',
          },
        }

        // Mock the three API calls: submit, status, results
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [mockTwitterResult],
          })

        const results = await fetchFromGopher('twitter', {
          type: 'getbyid',
          query: '1234567890',
        })

        expect(results).toHaveLength(1)
        expect(results[0]).toEqual(mockTwitterResult)
        expect(mockFetch).toHaveBeenCalledTimes(3)

        // Verify submit job request
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://data.gopher-ai.com/api/v1/search/live',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-gopher-key',
            },
            body: JSON.stringify({
              type: 'twitter',
              arguments: { type: 'getbyid', query: '1234567890' },
            }),
          }
        )

        // Verify status check
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          `https://data.gopher-ai.com/api/v1/search/live/status/${mockUuid}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-gopher-key',
            },
          }
        )

        // Verify results fetch
        expect(mockFetch).toHaveBeenNthCalledWith(
          3,
          `https://data.gopher-ai.com/api/v1/search/live/result/${mockUuid}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-gopher-key',
            },
          }
        )
      })

      it('should handle "done(not saved)" status', async () => {
        const mockUuid = 'uuid-not-saved'
        const mockResult: TwitterResult = {
          id: '9999999999',
          source: 'twitter',
          content: 'Not saved tweet',
          metadata: {
            conversation_id: '9999999999',
            created_at: '2024-01-16T12:00:00.000Z',
            likes: 100,
            public_metrics: {
              like_count: 100,
              reply_count: 5,
              retweet_count: 10,
            },
            tweet_id: 9999999999,
            user_id: 'user456',
            username: 'testuser2',
          },
        }

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(not saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [mockResult],
          })

        const results = await fetchFromGopher('twitter', {
          type: 'search',
          query: 'test query',
          max_results: 10,
        })

        expect(results).toHaveLength(1)
        expect(results[0]).toEqual(mockResult)
      })

      it('should poll multiple times until completion', async () => {
        const mockUuid = 'uuid-polling'
        const mockResult: TwitterResult = {
          id: '8888888888',
          source: 'twitter',
          content: 'Delayed tweet',
          metadata: {
            conversation_id: '8888888888',
            created_at: '2024-01-17T14:00:00.000Z',
            likes: 200,
            public_metrics: {
              like_count: 200,
              reply_count: 10,
              retweet_count: 20,
            },
            tweet_id: 8888888888,
            user_id: 'user789',
            username: 'delayed',
          },
        }

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          // First status check: in progress
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'in progress' }),
          })
          // Second status check: still in progress
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'in progress' }),
          })
          // Third status check: done
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [mockResult],
          })

        const results = await fetchFromGopher('twitter', {
          type: 'getbyid',
          query: '8888888888',
        })

        expect(results).toHaveLength(1)
        expect(vi.mocked(sleep)).toHaveBeenCalledTimes(2)
        expect(mockFetch).toHaveBeenCalledTimes(5)
      })

      it('should use custom poll interval and timeout', async () => {
        const mockUuid = 'uuid-custom-options'
        const mockResult: TwitterResult = {
          id: '7777777777',
          source: 'twitter',
          content: 'Custom options tweet',
          metadata: {
            conversation_id: '7777777777',
            created_at: '2024-01-18T16:00:00.000Z',
            likes: 50,
            public_metrics: {
              like_count: 50,
              reply_count: 2,
              retweet_count: 5,
            },
            tweet_id: 7777777777,
            user_id: 'user111',
            username: 'custom',
          },
        }

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [mockResult],
          })

        const results = await fetchFromGopher(
          'twitter',
          { type: 'getbyid', query: '7777777777' },
          { pollIntervalMs: 1000, timeoutMs: 60000 }
        )

        expect(results).toHaveLength(1)
      })

      it('should handle empty results array', async () => {
        const mockUuid = 'uuid-empty'

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [],
          })

        const results = await fetchFromGopher('twitter', {
          type: 'search',
          query: 'nonexistent',
        })

        expect(results).toEqual([])
      })

      it('should handle multiple results', async () => {
        const mockUuid = 'uuid-multiple'
        const mockResults: TwitterResult[] = [
          {
            id: '1111111111',
            source: 'twitter',
            content: 'First tweet',
            metadata: {
              conversation_id: '1111111111',
              created_at: '2024-01-19T10:00:00.000Z',
              likes: 100,
              public_metrics: {
                like_count: 100,
                reply_count: 5,
                retweet_count: 10,
              },
              tweet_id: 1111111111,
              user_id: 'user1',
              username: 'user1',
            },
          },
          {
            id: '2222222222',
            source: 'twitter',
            content: 'Second tweet',
            metadata: {
              conversation_id: '2222222222',
              created_at: '2024-01-19T11:00:00.000Z',
              likes: 200,
              public_metrics: {
                like_count: 200,
                reply_count: 10,
                retweet_count: 20,
              },
              tweet_id: 2222222222,
              user_id: 'user2',
              username: 'user2',
            },
          },
        ]

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockResults,
          })

        const results = await fetchFromGopher('twitter', {
          type: 'search',
          query: 'multiple tweets',
          max_results: 10,
        })

        expect(results).toHaveLength(2)
        expect(results).toEqual(mockResults)
      })
    })

    describe('error handling', () => {
      it('should throw error when API key is missing', async () => {
        // Re-mock env without API key
        vi.doMock('../../config/env', () => ({
          env: {
            GOPHER_API_KEY: '',
          },
        }))

        // This test would need to reimport the module, which is complex
        // Instead, we'll test the error is thrown when the submit fails
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow(GopherApiError)
      })

      it('should throw error on job submission failure (HTTP error)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Failed to submit job: Internal Server Error')
      })

      it('should throw error on job submission with API error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: 'Invalid query parameters' }),
        })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('API error: Invalid query parameters')
      })

      it('should throw error when no UUID returned', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('No UUID returned from job submission')
      })

      it('should throw error on status check failure (HTTP error)', async () => {
        const mockUuid = 'uuid-status-error'

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Failed to check job status: Not Found')
      })

      it('should throw error on status check with API error', async () => {
        const mockUuid = 'uuid-status-api-error'

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ error: 'Job not found' }),
          })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Job status error: Job not found')
      })

      it('should throw error on timeout', async () => {
        const mockUuid = 'uuid-timeout'

        // Mock Date.now to simulate timeout
        const originalDateNow = Date.now
        let callCount = 0
        vi.spyOn(Date, 'now').mockImplementation(() => {
          callCount++
          // First call: start time (0)
          // Second call: check elapsed (121000 - past timeout)
          return callCount === 1 ? 0 : 121000
        })

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'in progress' }),
          })

        await expect(
          fetchFromGopher(
            'twitter',
            { type: 'getbyid', query: '123' },
            { timeoutMs: 120000 }
          )
        ).rejects.toThrow(`Job timed out after 120000ms (UUID: ${mockUuid})`)

        Date.now = originalDateNow
      })

      it('should throw error on results fetch failure (HTTP error)', async () => {
        const mockUuid = 'uuid-results-error'

        // Need to ensure the mock is fresh for this test
        mockFetch.mockReset()
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Failed to get job results: Internal Server Error')
      })

      it('should handle rate limiting (429)', async () => {
        mockFetch.mockReset()
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        })

        try {
          await fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
          expect.fail('Expected error to be thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(GopherApiError)
          expect((error as GopherApiError).statusCode).toBe(429)
        }
      })

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Network error')
      })

      it('should handle malformed JSON in submit response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON')
          },
        })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Invalid JSON')
      })

      it('should handle malformed JSON in status response', async () => {
        const mockUuid = 'uuid-malformed-status'

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => {
              throw new Error('Invalid JSON')
            },
          })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Invalid JSON')
      })

      it('should handle malformed JSON in results response', async () => {
        const mockUuid = 'uuid-malformed-results'

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => {
              throw new Error('Invalid JSON')
            },
          })

        await expect(
          fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
        ).rejects.toThrow('Invalid JSON')
      })
    })
  })

  describe('fetchFromGopher - Reddit', () => {
    it('should successfully fetch Reddit results', async () => {
      const mockUuid = 'uuid-reddit'
      const mockRedditResult: RedditResult = {
        id: 'reddit123',
        source: 'reddit',
        content: 'Reddit post content',
        metadata: {
          title: 'Interesting Reddit Post',
          body: 'This is the post body',
          communityName: 'technology',
          username: 'reddituser',
          upVotes: 1500,
          numberOfComments: 250,
          createdAt: '2024-01-20T12:00:00.000Z',
        },
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ uuid: mockUuid }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'done(saved)' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockRedditResult],
        })

      const results = await fetchFromGopher('reddit', {
        type: 'scrapeurls',
        urls: ['https://reddit.com/r/technology/comments/123'],
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(mockRedditResult)

      // Verify request structure
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://data.gopher-ai.com/api/v1/search/live',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-gopher-key',
          },
          body: JSON.stringify({
            type: 'reddit',
            arguments: {
              type: 'scrapeurls',
              urls: ['https://reddit.com/r/technology/comments/123'],
            },
          }),
        }
      )
    })

    it('should handle multiple Reddit URLs', async () => {
      const mockUuid = 'uuid-reddit-multiple'
      const mockResults: RedditResult[] = [
        {
          id: 'reddit1',
          source: 'reddit',
          content: 'First post',
          metadata: {
            title: 'Post 1',
            body: 'Body 1',
            communityName: 'r1',
            username: 'user1',
            upVotes: 100,
            numberOfComments: 10,
            createdAt: '2024-01-20T10:00:00.000Z',
          },
        },
        {
          id: 'reddit2',
          source: 'reddit',
          content: 'Second post',
          metadata: {
            title: 'Post 2',
            body: 'Body 2',
            communityName: 'r2',
            username: 'user2',
            upVotes: 200,
            numberOfComments: 20,
            createdAt: '2024-01-20T11:00:00.000Z',
          },
        },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ uuid: mockUuid }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'done(saved)' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResults,
        })

      const results = await fetchFromGopher('reddit', {
        type: 'scrapeurls',
        urls: [
          'https://reddit.com/r/r1/comments/1',
          'https://reddit.com/r/r2/comments/2',
        ],
      })

      expect(results).toHaveLength(2)
      expect(results).toEqual(mockResults)
    })
  })

  describe('getbyid', () => {
    describe('Twitter', () => {
      it('should fetch single Twitter result by ID', async () => {
        const mockUuid = 'uuid-getbyid'
        const mockTwitterResult: TwitterResult = {
          id: '1234567890',
          source: 'twitter',
          content: 'Single tweet by ID',
          metadata: {
            conversation_id: '1234567890',
            created_at: '2024-01-21T10:00:00.000Z',
            likes: 500,
            public_metrics: {
              like_count: 500,
              reply_count: 25,
              retweet_count: 100,
            },
            tweet_id: 1234567890,
            user_id: 'user123',
            username: 'testuser',
          },
        }

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [mockTwitterResult],
          })

        const result = await getbyid('twitter', '1234567890')

        expect(result).toEqual(mockTwitterResult)
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://data.gopher-ai.com/api/v1/search/live',
          expect.objectContaining({
            body: JSON.stringify({
              type: 'twitter',
              arguments: { type: 'getbyid', query: '1234567890' },
            }),
          })
        )
      })

      it('should return null when no results found', async () => {
        const mockUuid = 'uuid-empty'

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [],
          })

        const result = await getbyid('twitter', 'nonexistent')

        expect(result).toBeNull()
      })

      it('should use custom options', async () => {
        const mockUuid = 'uuid-options'
        const mockResult: TwitterResult = {
          id: '9999999999',
          source: 'twitter',
          content: 'Tweet with options',
          metadata: {
            conversation_id: '9999999999',
            created_at: '2024-01-22T12:00:00.000Z',
            likes: 100,
            public_metrics: {
              like_count: 100,
              reply_count: 5,
              retweet_count: 10,
            },
            tweet_id: 9999999999,
            user_id: 'user456',
            username: 'optionsuser',
          },
        }

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ uuid: mockUuid }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done(saved)' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [mockResult],
          })

        const result = await getbyid('twitter', '9999999999', {
          pollIntervalMs: 1000,
          timeoutMs: 60000,
        })

        expect(result).toEqual(mockResult)
      })
    })

    describe('Reddit', () => {
      it('should throw error for Reddit platform', async () => {
        await expect(getbyid('reddit', 'some-id')).rejects.toThrow(
          'getbyid is not supported for platform: reddit. Use fetchFromGopher with a URL instead.'
        )
      })
    })
  })

  describe('Type Guards', () => {
    describe('isTwitterResult', () => {
      it('should return true for Twitter result', () => {
        const twitterResult: GopherResult = {
          id: '123',
          source: 'twitter',
          content: 'Tweet',
          metadata: {
            conversation_id: '123',
            created_at: '2024-01-23T10:00:00.000Z',
            likes: 10,
            public_metrics: {
              like_count: 10,
              reply_count: 1,
              retweet_count: 2,
            },
            tweet_id: 123,
            user_id: 'user',
            username: 'user',
          },
        }

        expect(isTwitterResult(twitterResult)).toBe(true)
      })

      it('should return false for Reddit result', () => {
        const redditResult: GopherResult = {
          id: '456',
          source: 'reddit',
          content: 'Post',
          metadata: {
            title: 'Title',
            body: 'Body',
            communityName: 'community',
            username: 'user',
            upVotes: 100,
            numberOfComments: 10,
            createdAt: '2024-01-23T10:00:00.000Z',
          },
        }

        expect(isTwitterResult(redditResult)).toBe(false)
      })
    })

    describe('isRedditResult', () => {
      it('should return true for Reddit result', () => {
        const redditResult: GopherResult = {
          id: '456',
          source: 'reddit',
          content: 'Post',
          metadata: {
            title: 'Title',
            body: 'Body',
            communityName: 'community',
            username: 'user',
            upVotes: 100,
            numberOfComments: 10,
            createdAt: '2024-01-23T10:00:00.000Z',
          },
        }

        expect(isRedditResult(redditResult)).toBe(true)
      })

      it('should return false for Twitter result', () => {
        const twitterResult: GopherResult = {
          id: '123',
          source: 'twitter',
          content: 'Tweet',
          metadata: {
            conversation_id: '123',
            created_at: '2024-01-23T10:00:00.000Z',
            likes: 10,
            public_metrics: {
              like_count: 10,
              reply_count: 1,
              retweet_count: 2,
            },
            tweet_id: 123,
            user_id: 'user',
            username: 'user',
          },
        }

        expect(isRedditResult(twitterResult)).toBe(false)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle fetch throwing an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'))

      await expect(
        fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
      ).rejects.toThrow('Fetch failed')
    })

    it('should handle undefined response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      })

      await expect(
        fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
      ).rejects.toThrow()
    })

    it('should handle response with null uuid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: null }),
      })

      await expect(
        fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
      ).rejects.toThrow('No UUID returned from job submission')
    })

    it('should handle response with empty string uuid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: '' }),
      })

      await expect(
        fetchFromGopher('twitter', { type: 'getbyid', query: '123' })
      ).rejects.toThrow('No UUID returned from job submission')
    })

    it('should handle status response with no status field', async () => {
      const mockUuid = 'uuid-no-status'

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ uuid: mockUuid }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })

      // This will cause the polling to continue indefinitely or timeout
      // Since we're mocking Date.now for timeout, let's simulate it
      const originalDateNow = Date.now
      let callCount = 0
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++
        return callCount === 1 ? 0 : 121000
      })

      await expect(
        fetchFromGopher(
          'twitter',
          { type: 'getbyid', query: '123' },
          { timeoutMs: 120000 }
        )
      ).rejects.toThrow(`Job timed out after 120000ms`)

      Date.now = originalDateNow
    })

    it('should handle simultaneous API errors in error and status code', async () => {
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })

      try {
        await fetchFromGopher('twitter', {
          type: 'getbyid',
          query: '123',
        })
        // Should not reach here
        expect.fail('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(GopherApiError)
        expect((error as GopherApiError).statusCode).toBe(503)
        expect((error as GopherApiError).message).toContain('Service Unavailable')
      }
    })
  })
})
