/**
 * Tests for admin authentication middleware
 *
 * Coverage:
 * 1. Authentication requirement
 * 2. User ID requirement
 * 3. Admin status verification from database
 * 4. Access denial for non-admin users
 * 5. Database error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'

// Mock Supabase client before importing the middleware
const mockSupabaseSelect = vi.fn()
const mockSupabaseEq = vi.fn()
const mockSupabaseSingle = vi.fn()

vi.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
    })),
  },
}))

// Import after mocking
import { adminAuthMiddleware } from '../admin-auth'

// Create mock context factory
const createMockContext = (user?: { id: string; email?: string }): Context => {
  return {
    get: vi.fn((key: string) => (key === 'user' ? user : undefined)),
    set: vi.fn(),
    req: {},
    res: {},
  } as unknown as Context
}

// Create mock next function
const createMockNext = (): Next => vi.fn().mockResolvedValue(undefined)

describe('Admin Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock chain
    mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq })
    mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication Requirement', () => {
    it('should throw 401 when no user is set', async () => {
      const ctx = createMockContext(undefined)
      const next = createMockNext()

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      try {
        await adminAuthMiddleware(ctx, next)
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException)
        expect((error as HTTPException).status).toBe(401)
        expect((error as HTTPException).message).toBe('Authentication required')
      }
    })
  })

  describe('User ID Requirement', () => {
    it('should throw 403 when user has no ID', async () => {
      const ctx = createMockContext({ id: '', email: 'user@example.com' })
      const next = createMockNext()

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      try {
        await adminAuthMiddleware(ctx, next)
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException)
        expect((error as HTTPException).status).toBe(403)
        expect((error as HTTPException).message).toBe('User ID required for admin access')
      }
    })
  })

  describe('Admin Status Verification', () => {
    it('should allow access for admin user', async () => {
      const ctx = createMockContext({ id: 'admin-1', email: 'admin@example.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      })

      await adminAuthMiddleware(ctx, next)

      expect(next).toHaveBeenCalled()
      expect(mockSupabaseSelect).toHaveBeenCalledWith('is_admin')
      expect(mockSupabaseEq).toHaveBeenCalledWith('id', 'admin-1')
    })

    it('should throw 403 for non-admin user', async () => {
      const ctx = createMockContext({ id: 'user-1', email: 'regular@user.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: { is_admin: false },
        error: null,
      })

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      try {
        await adminAuthMiddleware(ctx, next)
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException)
        expect((error as HTTPException).status).toBe(403)
        expect((error as HTTPException).message).toBe('Forbidden: Admin access required')
      }
    })

    it('should throw 403 when user data is null', async () => {
      const ctx = createMockContext({ id: 'user-1', email: 'user@example.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: null,
      })

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      try {
        await adminAuthMiddleware(ctx, next)
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException)
        expect((error as HTTPException).status).toBe(403)
      }
    })

    it('should not call next() for non-admin users', async () => {
      const ctx = createMockContext({ id: 'user-1', email: 'notadmin@example.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: { is_admin: false },
        error: null,
      })

      try {
        await adminAuthMiddleware(ctx, next)
      } catch {
        // Expected to throw
      }

      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Database Error Handling', () => {
    it('should throw 500 when database query fails', async () => {
      const ctx = createMockContext({ id: 'user-1', email: 'user@example.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      try {
        await adminAuthMiddleware(ctx, next)
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException)
        expect((error as HTTPException).status).toBe(500)
        expect((error as HTTPException).message).toBe('Failed to verify admin access')
      }
    })

    it('should throw 500 when database returns unexpected error', async () => {
      const ctx = createMockContext({ id: 'admin-1', email: 'admin@example.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { message: 'Table does not exist' },
      })

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      try {
        await adminAuthMiddleware(ctx, next)
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException)
        expect((error as HTTPException).status).toBe(500)
      }
    })
  })

  describe('Integration Flow', () => {
    it('should complete full authentication flow for admin user', async () => {
      const ctx = createMockContext({ id: 'admin-1', email: 'admin@example.com' })
      const next = createMockNext()

      mockSupabaseSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      })

      await adminAuthMiddleware(ctx, next)

      // Verify all steps were executed
      expect(mockSupabaseSelect).toHaveBeenCalledWith('is_admin')
      expect(mockSupabaseEq).toHaveBeenCalledWith('id', 'admin-1')
      expect(mockSupabaseSingle).toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('should reject and not query database when user is missing', async () => {
      const ctx = createMockContext(undefined)
      const next = createMockNext()

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      // Database should not be queried if user is missing
      expect(mockSupabaseSelect).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject and not query database when user ID is missing', async () => {
      const ctx = createMockContext({ id: '', email: 'user@example.com' })
      const next = createMockNext()

      await expect(adminAuthMiddleware(ctx, next)).rejects.toThrow(HTTPException)

      // Database should not be queried if user ID is missing
      expect(mockSupabaseSelect).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })
  })
})
