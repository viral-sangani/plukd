/**
 * Comprehensive tests for user API routes
 *
 * Coverage:
 * 1. GET /api/user - Get current user profile
 *    - Happy paths: existing users, minimal profiles, telegram linked
 *    - Error paths: PGRST116 (user not found), database errors
 *    - Response validation: field presence, null handling
 *    - Edge cases: incomplete telegram data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// Mock Supabase admin client - creates chainable mock that is also thenable
const createMockSupabaseChain = () => {
  // Default response when the chain is awaited
  let pendingResponse: { data: unknown; error: unknown } = { data: null, error: null }

  const chain: Record<string, any> = {}

  // Make chain thenable - when awaited, resolve with pendingResponse
  chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
    return Promise.resolve(pendingResponse).then(resolve, reject)
  }

  // Chainable methods - return the chain object
  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is', 'not',
    'gt', 'lt', 'gte', 'lte',
    'like', 'ilike', 'contains', 'overlaps', 'or',
    'order',
  ]

  for (const method of chainableMethods) {
    chain[method] = vi.fn().mockImplementation(() => chain)
  }

  // Terminal methods - return promises directly
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(pendingResponse))
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

  // from() method - returns the chain
  chain.from = vi.fn().mockImplementation(() => chain)

  // Helper to set the pending response for thenable resolution
  chain._setResponse = (response: { data: unknown; error: unknown }) => {
    pendingResponse = response
  }

  return chain
}

// Mock auth middleware to inject user
vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    // Extract user ID from token (mock format: Bearer user-{id} or Bearer {email})
    const token = authHeader.slice(7)
    const userId = token.startsWith('user-') ? token.replace('user-', '') : token
    const email = token.includes('@') ? token : `${userId}@test.com`
    c.set('user', {
      id: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
    })
    await next()
  }),
}))

// Mock Supabase
let mockSupabase: ReturnType<typeof createMockSupabaseChain>
vi.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    get from() {
      return (...args: unknown[]) => mockSupabase.from(...args)
    },
  },
}))

// Import after mocks
import { userRoutes } from '../user'

// Test data factories
interface DatabaseUser {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  telegram_chat_id: string | null
  telegram_username: string | null
  telegram_linked_at: string | null
  created_at: string
  updated_at: string
}

const createTestDatabaseUser = (overrides: Partial<DatabaseUser> = {}): DatabaseUser => ({
  id: 'user-123',
  email: 'user-123@test.com',
  name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  telegram_chat_id: '123456789',
  telegram_username: 'testuser',
  telegram_linked_at: '2024-01-15T10:00:00.000Z',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-15T10:00:00.000Z',
  ...overrides,
})

// Test utilities
function createTestApp() {
  const app = new Hono()
  app.route('/api/user', userRoutes)
  return app
}

function createMockRequest(options: {
  method?: string
  path?: string
  headers?: Record<string, string>
  userId?: string
  userEmail?: string
}) {
  const url = `http://localhost/api/user${options.path || ''}`
  const headers = new Headers(options.headers || {})

  // Add auth header with user ID or email
  if (options.userId) {
    headers.set('Authorization', `Bearer user-${options.userId}`)
  } else if (options.userEmail) {
    headers.set('Authorization', `Bearer ${options.userEmail}`)
  }

  return new Request(url, {
    method: options.method || 'GET',
    headers,
  })
}

describe('User Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseChain()
    app = createTestApp()
  })

  describe('GET /api/user - Get Current User Profile', () => {
    describe('Happy Path', () => {
      it('should return existing user with complete profile', async () => {
        const mockUser = createTestDatabaseUser()
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual(mockUser)

        expect(mockSupabase.from).toHaveBeenCalledWith('users')
        expect(mockSupabase.select).toHaveBeenCalledWith('*')
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'user-123')
        expect(mockSupabase.single).toHaveBeenCalled()
      })

      it('should return user with minimal profile (nulls for optional fields)', async () => {
        const mockUser = createTestDatabaseUser({
          name: null,
          avatar_url: null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual(mockUser)
        expect(data.name).toBeNull()
        expect(data.avatar_url).toBeNull()
        expect(data.telegram_chat_id).toBeNull()
      })

      it('should include telegram info when linked', async () => {
        const mockUser = createTestDatabaseUser({
          telegram_chat_id: '987654321',
          telegram_username: 'linkeduser',
          telegram_linked_at: '2024-01-20T12:30:00.000Z',
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const userData = await res.json() as DatabaseUser
        expect(userData.telegram_chat_id).toBe('987654321')
        expect(userData.telegram_username).toBe('linkeduser')
        expect(userData.telegram_linked_at).toBe('2024-01-20T12:30:00.000Z')
      })
    })

    describe('Error Handling', () => {
      it('should return minimal auth data when user not in database (PGRST116)', async () => {
        mockSupabase._setResponse({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        })

        const req = createMockRequest({ userId: 'new-user-456' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        expect(response.id).toBe('new-user-456')
        expect(response.email).toBe('new-user-456@test.com')
        expect(response.name).toBeNull()
        expect(response.avatar_url).toBeNull()
        expect(response.telegram_chat_id).toBeNull()
        expect(response.telegram_username).toBeNull()
        expect(response.telegram_linked_at).toBeNull()
        expect(response.created_at).toBeDefined()
        expect(response.updated_at).toBeDefined()

        // Verify timestamp format (ISO 8601)
        expect(() => new Date(response.created_at)).not.toThrow()
        expect(() => new Date(response.updated_at)).not.toThrow()
      })

      it('should return minimal auth data when user has no email (PGRST116)', async () => {
        mockSupabase._setResponse({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        })

        const req = createMockRequest({ userId: 'user-no-email' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        expect(response.id).toBe('user-no-email')
        expect(response.email).toBe('user-no-email@test.com')
      })

      it('should return 500 on database error (non-PGRST116)', async () => {
        mockSupabase._setResponse({
          data: null,
          error: { code: 'CONNECTION_ERROR', message: 'Database connection failed' },
        })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data).toEqual({ error: 'Failed to fetch user profile' })
      })

      it('should return 500 on unexpected exception', async () => {
        // Make the chain throw an unexpected error
        mockSupabase.single = vi.fn().mockRejectedValue(new Error('Network timeout'))

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data).toEqual({ error: 'Internal server error' })
      })

      it('should handle database timeout error gracefully', async () => {
        mockSupabase._setResponse({
          data: null,
          error: { code: 'PGRST504', message: 'Gateway timeout' },
        })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data).toEqual({ error: 'Failed to fetch user profile' })
      })

      it('should return 401 when no auth header provided', async () => {
        const req = createMockRequest({ path: '' }) // No userId
        const res = await app.fetch(req)

        expect(res.status).toBe(401)
        const data = await res.json()
        expect(data).toEqual({ error: 'Unauthorized' })
      })
    })

    describe('Response Validation', () => {
      it('should include all expected fields in response', async () => {
        const mockUser = createTestDatabaseUser()
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        expect(response).toHaveProperty('id')
        expect(response).toHaveProperty('email')
        expect(response).toHaveProperty('name')
        expect(response).toHaveProperty('avatar_url')
        expect(response).toHaveProperty('telegram_chat_id')
        expect(response).toHaveProperty('telegram_username')
        expect(response).toHaveProperty('telegram_linked_at')
        expect(response).toHaveProperty('created_at')
        expect(response).toHaveProperty('updated_at')
      })

      it('should return null for missing fields (not undefined)', async () => {
        const mockUser = createTestDatabaseUser({
          name: null,
          avatar_url: null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        expect(response.name).toBeNull()
        expect(response.avatar_url).toBeNull()
        expect(response.telegram_chat_id).toBeNull()
        expect(response.telegram_username).toBeNull()
        expect(response.telegram_linked_at).toBeNull()

        // Ensure they're null, not undefined
        expect(response.name).not.toBeUndefined()
        expect(response.avatar_url).not.toBeUndefined()
      })

      it('should return valid ISO timestamp strings', async () => {
        const mockUser = createTestDatabaseUser({
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-15T10:30:45.123Z',
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        // Should be valid ISO timestamp strings
        expect(() => new Date(response.created_at)).not.toThrow()
        expect(() => new Date(response.updated_at)).not.toThrow()

        const createdDate = new Date(response.created_at)
        const updatedDate = new Date(response.updated_at)

        expect(createdDate.toISOString()).toBe('2024-01-01T00:00:00.000Z')
        expect(updatedDate.toISOString()).toBe('2024-01-15T10:30:45.123Z')
      })
    })

    describe('Edge Cases', () => {
      it('should handle incomplete telegram linking (chat_id but no username)', async () => {
        const mockUser = createTestDatabaseUser({
          telegram_chat_id: '123456',
          telegram_username: null,
          telegram_linked_at: '2024-01-15T10:00:00.000Z',
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        expect(response.telegram_chat_id).toBe('123456')
        expect(response.telegram_username).toBeNull()
        expect(response.telegram_linked_at).toBe('2024-01-15T10:00:00.000Z')
      })

      it('should handle incomplete telegram linking (username but no chat_id)', async () => {
        const mockUser = createTestDatabaseUser({
          telegram_chat_id: null,
          telegram_username: 'orphaneduser',
          telegram_linked_at: null,
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        expect(response.telegram_chat_id).toBeNull()
        expect(response.telegram_username).toBe('orphaneduser')
        expect(response.telegram_linked_at).toBeNull()
      })

      it('should handle user with only telegram_linked_at timestamp', async () => {
        const mockUser = createTestDatabaseUser({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: '2024-01-15T10:00:00.000Z',
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        // Orphaned timestamp without actual telegram data
        expect(response.telegram_chat_id).toBeNull()
        expect(response.telegram_username).toBeNull()
        expect(response.telegram_linked_at).toBe('2024-01-15T10:00:00.000Z')
      })

      it('should handle user with empty string email', async () => {
        const mockUser = createTestDatabaseUser({
          email: '',
        })
        mockSupabase._setResponse({ data: mockUser, error: null })

        const req = createMockRequest({ userId: 'user-123' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as DatabaseUser

        // Empty string should be preserved (not converted to null)
        expect(response.email).toBe('')
      })

      it('should handle PGRST116 with different user IDs', async () => {
        mockSupabase._setResponse({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        })

        const req = createMockRequest({ userId: 'completely-new-user' })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const response = await res.json() as any

        expect(response.id).toBe('completely-new-user')
        expect(response.email).toBe('completely-new-user@test.com')
      })
    })
  })
})
