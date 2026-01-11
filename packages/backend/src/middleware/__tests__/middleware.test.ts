/**
 * Comprehensive test suite for backend middleware
 *
 * Coverage goals:
 * - auth.ts: 95%+ statements, 90%+ branches, 100% functions
 * - error-handler.ts: 100% statements, 100% branches, 100% functions
 *
 * Total: 41 tests for auth and error-handler middleware
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError, z } from 'zod'

// =============================================================================
// MOCKS
// =============================================================================

// Mock jose at the module level
const mockJwtVerify = vi.fn()
const mockCreateRemoteJWKSet = vi.fn(() => 'mock-jwks')

vi.mock('jose', () => {
  class JWTExpired extends Error {
    constructor(message = 'JWT expired') {
      super(message)
      this.name = 'JWTExpired'
    }
  }

  class JWTInvalid extends Error {
    constructor(message = 'JWT invalid') {
      super(message)
      this.name = 'JWTInvalid'
    }
  }

  return {
    jwtVerify: (...args: any[]) => mockJwtVerify(...args),
    createRemoteJWKSet: (...args: any[]) => mockCreateRemoteJWKSet(...args),
    errors: {
      JWTExpired,
      JWTInvalid,
    },
  }
})

// =============================================================================
// TEST HELPERS
// =============================================================================

interface MockContextOptions {
  headers?: Record<string, string>
  user?: any
  [key: string]: any
}

function createMockContext(options: MockContextOptions = {}): Context {
  const context = {
    req: {
      header: (name: string) => options.headers?.[name],
    },
    set: vi.fn(),
    json: vi.fn((data, status) => ({ data, status })),
    get: vi.fn((key) => options[key]),
  } as unknown as Context

  return context
}

function createMockNext(): Next {
  return vi.fn(async () => {})
}

// =============================================================================
// AUTH MIDDLEWARE TESTS
// =============================================================================

describe('Auth Middleware', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Happy Path', () => {
    it('should authenticate valid JWT with authenticated role', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer valid-token' },
      })
      const next = createMockNext()

      await authMiddleware(context, next)

      expect(context.set).toHaveBeenCalledWith('user', {
        id: 'user-123',
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
      })
      expect(next).toHaveBeenCalledOnce()
    })

    it('should authenticate valid JWT without email field', async () => {
      const mockPayload = {
        sub: 'user-456',
        role: 'authenticated',
        aud: 'authenticated',
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer valid-token-no-email' },
      })
      const next = createMockNext()

      await authMiddleware(context, next)

      expect(context.set).toHaveBeenCalledWith('user', {
        id: 'user-456',
        email: undefined,
        role: 'authenticated',
        aud: 'authenticated',
      })
      expect(next).toHaveBeenCalledOnce()
    })

    it('should verify JWT with ES256 algorithm constraint', async () => {
      const mockPayload = {
        sub: 'user-789',
        role: 'authenticated',
        aud: 'authenticated',
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer es256-token' },
      })
      const next = createMockNext()

      await authMiddleware(context, next)

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'es256-token',
        'mock-jwks',
        expect.objectContaining({ algorithms: ['ES256'] })
      )
      expect(next).toHaveBeenCalledOnce()
    })

    it('should preserve aud claim in user context', async () => {
      const mockPayload = {
        sub: 'user-999',
        role: 'authenticated',
        aud: 'custom-audience',
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer aud-token' },
      })
      const next = createMockNext()

      await authMiddleware(context, next)

      expect(context.set).toHaveBeenCalledWith('user', expect.objectContaining({
        aud: 'custom-audience',
      }))
    })
  })

  describe('Error Handling', () => {
    it('should reject request with missing Authorization header', async () => {
      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: {},
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow(
        'Missing or invalid Authorization header'
      )

      expect(next).not.toHaveBeenCalled()
    })

    it('should reject Authorization header without Bearer prefix', async () => {
      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Basic xyz123' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow(
        'Missing or invalid Authorization header'
      )
    })

    it('should reject empty Bearer token', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTInvalid('Invalid token')
      )

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer ' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('Invalid token')
    })

    it('should reject expired JWT', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTExpired('token is expired')
      )

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer expired-token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('Token expired')
    })

    it('should reject invalid JWT signature', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTInvalid('signature verification failed')
      )

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer invalid-signature' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('Invalid token')
    })

    it('should reject JWT missing subject (sub) claim', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { role: 'authenticated', aud: 'authenticated' },
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer no-sub-token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow(
        'Invalid token: missing subject'
      )
    })

    it('should reject JWT with wrong role (anon)', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-123', role: 'anon', aud: 'authenticated' },
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer anon-token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('User not authenticated')
    })

    it('should reject JWT with wrong role (service_role)', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'service-123', role: 'service_role', aud: 'authenticated' },
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer service-token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('User not authenticated')
    })

    it('should handle malformed JWT', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTInvalid('malformed token')
      )

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer not-a-real-jwt' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('Invalid token')
    })

    it('should handle JWKS fetch failure', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Network error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer valid-token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('Authentication failed')

      expect(consoleErrorSpy).toHaveBeenCalledWith('[auth] Error:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    it('should handle unknown jose error', async () => {
      const unknownError = new Error('Unknown JWT error')
      mockJwtVerify.mockRejectedValue(unknownError)
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow('Authentication failed')

      expect(consoleErrorSpy).toHaveBeenCalledWith('[auth] Error:', unknownError)

      consoleErrorSpy.mockRestore()
    })

    it('should re-throw HTTPException from internal validation', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { role: 'authenticated', aud: 'authenticated' }, // missing sub
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer token' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)
      await expect(authMiddleware(context, next)).rejects.toThrow(
        'Invalid token: missing subject'
      )
    })
  })

  describe('Security', () => {
    it('should not log token in error messages', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockJwtVerify.mockRejectedValue(new Error('Test error'))

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer secret-token-12345' },
      })
      const next = createMockNext()

      await expect(authMiddleware(context, next)).rejects.toThrow(HTTPException)

      // Check that token is not in console.error calls
      const errorCalls = consoleErrorSpy.mock.calls
      errorCalls.forEach((call) => {
        const callStr = JSON.stringify(call)
        expect(callStr).not.toContain('secret-token-12345')
      })

      consoleErrorSpy.mockRestore()
    })

    it('should enforce ES256 algorithm', async () => {
      const mockPayload = {
        sub: 'user-123',
        role: 'authenticated',
        aud: 'authenticated',
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'ES256' },
      })

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer token' },
      })
      const next = createMockNext()

      await authMiddleware(context, next)

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'token',
        'mock-jwks',
        expect.objectContaining({ algorithms: ['ES256'] })
      )
    })

    it('should not expose token in HTTPException messages', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTExpired('token expired')
      )

      const { authMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer secret-token' },
      })
      const next = createMockNext()

      try {
        await authMiddleware(context, next)
      } catch (error) {
        if (error instanceof HTTPException) {
          expect(error.message).not.toContain('secret-token')
          expect(error.message).toBe('Token expired')
        }
      }
    })
  })

  describe('Optional Auth Middleware', () => {
    it('should authenticate with valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'ES256' },
      })

      const { optionalAuthMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer valid-token' },
      })
      const next = createMockNext()

      await optionalAuthMiddleware(context, next)

      expect(context.set).toHaveBeenCalledWith('user', expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com',
      }))
      expect(next).toHaveBeenCalledOnce()
    })

    it('should continue without authentication when no token provided', async () => {
      const { optionalAuthMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: {},
      })
      const next = createMockNext()

      await optionalAuthMiddleware(context, next)

      expect(context.set).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledOnce()
    })

    it('should continue without authentication when invalid token provided', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTInvalid('Invalid token')
      )

      const { optionalAuthMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer invalid-token' },
      })
      const next = createMockNext()

      // Should NOT throw error
      await optionalAuthMiddleware(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('should continue without authentication when expired token provided', async () => {
      const jose = await import('jose')

      mockJwtVerify.mockRejectedValue(
        new jose.errors.JWTExpired('Token expired')
      )

      const { optionalAuthMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Bearer expired-token' },
      })
      const next = createMockNext()

      // Should NOT throw error
      await optionalAuthMiddleware(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('should continue when Bearer prefix missing', async () => {
      const { optionalAuthMiddleware } = await import('../auth')

      const context = createMockContext({
        headers: { Authorization: 'Basic credentials' },
      })
      const next = createMockNext()

      await optionalAuthMiddleware(context, next)

      expect(next).toHaveBeenCalledOnce()
      expect(context.set).not.toHaveBeenCalled()
    })
  })
})

// =============================================================================
// ERROR HANDLER MIDDLEWARE TESTS
// =============================================================================

describe('Error Handler Middleware', () => {
  let errorHandler: typeof import('../error-handler').errorHandler

  beforeEach(async () => {
    vi.clearAllMocks()

    const errorModule = await import('../error-handler')
    errorHandler = errorModule.errorHandler
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('HTTPException Handling', () => {
    it('should handle 401 Unauthorized', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new HTTPException(401, { message: 'Invalid token' })
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[error]', error)

      consoleErrorSpy.mockRestore()
    })

    it('should handle 403 Forbidden', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new HTTPException(403, { message: 'Permission denied' })
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Permission denied' }, 403)

      consoleErrorSpy.mockRestore()
    })

    it('should handle 404 Not Found', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new HTTPException(404, { message: 'Resource not found' })
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Resource not found' }, 404)

      consoleErrorSpy.mockRestore()
    })

    it('should handle 500 Internal Server Error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new HTTPException(500, { message: 'Database error' })
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Database error' }, 500)

      consoleErrorSpy.mockRestore()
    })

    it('should handle custom status codes (422)', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new HTTPException(422, { message: 'Unprocessable Entity' })
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Unprocessable Entity' }, 422)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Zod Validation Error Handling', () => {
    it('should handle single validation error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const schema = z.object({
        email: z.string().email(),
      })

      let zodError: ZodError
      try {
        schema.parse({ email: 'invalid-email' })
      } catch (err) {
        zodError = err as ZodError
      }

      const context = createMockContext()
      const result = errorHandler(zodError!, context)

      expect(context.json).toHaveBeenCalledWith(
        {
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              code: expect.any(String),
              path: expect.any(Array),
            }),
          ]),
        },
        400
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle multiple validation errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const schema = z.object({
        email: z.string().email(),
        age: z.number().positive(),
        name: z.string().min(3),
      })

      let zodError: ZodError
      try {
        schema.parse({ email: 'invalid', age: -5, name: 'ab' })
      } catch (err) {
        zodError = err as ZodError
      }

      const context = createMockContext()
      const result = errorHandler(zodError!, context)

      expect(context.json).toHaveBeenCalledWith(
        {
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ path: ['email'] }),
            expect.objectContaining({ path: ['age'] }),
            expect.objectContaining({ path: ['name'] }),
          ]),
        },
        400
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle nested object validation', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email(),
          }),
        }),
      })

      let zodError: ZodError
      try {
        schema.parse({ user: { profile: { email: 'invalid' } } })
      } catch (err) {
        zodError = err as ZodError
      }

      const context = createMockContext()
      const result = errorHandler(zodError!, context)

      expect(context.json).toHaveBeenCalledWith(
        {
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: ['user', 'profile', 'email'],
            }),
          ]),
        },
        400
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle array validation', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const schema = z.object({
        items: z.array(z.number().positive()),
      })

      let zodError: ZodError
      try {
        schema.parse({ items: [1, -2, 3, -4] })
      } catch (err) {
        zodError = err as ZodError
      }

      const context = createMockContext()
      const result = errorHandler(zodError!, context)

      expect(context.json).toHaveBeenCalledWith(
        {
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: expect.arrayContaining(['items']),
            }),
          ]),
        },
        400
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Generic Error Handling', () => {
    it('should handle unknown error type with generic message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Database connection failed')
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Internal server error' }, 500)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[error]', error)

      consoleErrorSpy.mockRestore()
    })

    it('should handle error with no message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error()
      const context = createMockContext()

      const result = errorHandler(error, context)

      expect(context.json).toHaveBeenCalledWith({ error: 'Internal server error' }, 500)

      consoleErrorSpy.mockRestore()
    })

    it('should handle error with special characters (XSS prevention)', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error("Error with <script>alert('xss')</script>")
      const context = createMockContext()

      const result = errorHandler(error, context)

      // Should NOT expose original error message
      expect(context.json).toHaveBeenCalledWith({ error: 'Internal server error' }, 500)

      const jsonCall = vi.mocked(context.json).mock.calls[0][0]
      expect(JSON.stringify(jsonCall)).not.toContain('<script>')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Logging & Security', () => {
    it('should log all errors with [error] prefix', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error1 = new HTTPException(401, { message: 'Unauthorized' })
      const error2 = new Error('Generic error')
      const context = createMockContext()

      errorHandler(error1, context)
      errorHandler(error2, context)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[error]', error1)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[error]', error2)

      consoleErrorSpy.mockRestore()
    })

    it('should not expose stack traces in response', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.ts:123:45'

      const context = createMockContext()

      errorHandler(error, context)

      const jsonCall = vi.mocked(context.json).mock.calls[0][0]
      expect(jsonCall).not.toHaveProperty('stack')
      expect(JSON.stringify(jsonCall)).not.toContain('test.ts:123:45')

      consoleErrorSpy.mockRestore()
    })

    it('should return consistent error format for HTTPException', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new HTTPException(400, { message: 'Bad request' })
      const context = createMockContext()

      errorHandler(error, context)

      const jsonCall = vi.mocked(context.json).mock.calls[0][0]
      expect(jsonCall).toEqual({ error: 'Bad request' })
      expect(Object.keys(jsonCall)).toEqual(['error'])

      consoleErrorSpy.mockRestore()
    })

    it('should return consistent error format for ZodError', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const schema = z.object({ email: z.string().email() })
      let zodError: ZodError
      try {
        schema.parse({ email: 'invalid' })
      } catch (err) {
        zodError = err as ZodError
      }

      const context = createMockContext()
      errorHandler(zodError!, context)

      const jsonCall = vi.mocked(context.json).mock.calls[0][0]
      expect(Object.keys(jsonCall).sort()).toEqual(['details', 'error'])
      expect(jsonCall).toHaveProperty('error', 'Validation failed')
      expect(jsonCall).toHaveProperty('details')
      expect(Array.isArray(jsonCall.details)).toBe(true)

      consoleErrorSpy.mockRestore()
    })

    it('should return consistent error format for generic errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Something went wrong')
      const context = createMockContext()

      errorHandler(error, context)

      const jsonCall = vi.mocked(context.json).mock.calls[0][0]
      expect(jsonCall).toEqual({ error: 'Internal server error' })
      expect(Object.keys(jsonCall)).toEqual(['error'])

      consoleErrorSpy.mockRestore()
    })
  })
})
