/**
 * Comprehensive test suite for CORS middleware
 *
 * Coverage goals:
 * - cors.ts: 100% statements, 100% branches, 100% functions
 *
 * Total: 28 tests covering development/production modes, security, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// =============================================================================
// MOCKS
// =============================================================================

// Mock the honoCors function to capture configuration
let capturedCorsConfig: any = null
const mockHonoCors = vi.fn((config) => {
  capturedCorsConfig = config
  return async () => {} // Return a mock middleware function
})

vi.mock('hono/cors', () => ({
  cors: mockHonoCors,
}))

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Helper to extract and test the origin callback from captured CORS config
 */
function testOriginCallback(origin: string | undefined): string | null {
  if (!capturedCorsConfig) {
    throw new Error('No CORS config captured')
  }

  if (typeof capturedCorsConfig.origin === 'function') {
    return capturedCorsConfig.origin(origin)
  }

  // In production mode, origin is an array
  if (Array.isArray(capturedCorsConfig.origin)) {
    return capturedCorsConfig.origin.includes(origin) ? origin || null : null
  }

  return null
}

/**
 * Helper to get a fresh CORS instance with specific env configuration
 */
async function setupCorsWithEnv(nodeEnv: string, corsOrigin: string) {
  // Reset captured config
  capturedCorsConfig = null
  vi.clearAllMocks()
  vi.resetModules()

  // Mock env before importing
  vi.doMock('../../config/env', () => ({
    env: {
      NODE_ENV: nodeEnv,
      CORS_ORIGIN: corsOrigin,
    },
  }))

  // Import and call cors() to capture config
  const { cors } = await import('../cors')
  cors()

  return capturedCorsConfig
}

// =============================================================================
// CORS MIDDLEWARE TESTS
// =============================================================================

describe('CORS Middleware', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===========================================================================
  // A. DEVELOPMENT MODE TESTS (10 tests)
  // ===========================================================================

  describe('Development Mode', () => {
    it('should allow chrome-extension origins', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('chrome-extension://abcdefghij123456')

      expect(result).toBe('chrome-extension://abcdefghij123456')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[cors] Request from origin:',
        'chrome-extension://abcdefghij123456'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('[cors] ✅ Allowing chrome extension origin')
    })

    it('should allow localhost with port 3000', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('http://localhost:3000')

      expect(result).toBe('http://localhost:3000')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[cors] ✅ Allowing localhost/configured origin'
      )
    })

    it('should allow localhost with port 3001', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('http://localhost:3001')

      expect(result).toBe('http://localhost:3001')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[cors] ✅ Allowing localhost/configured origin'
      )
    })

    it('should allow localhost with port 5000', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('http://localhost:5000')

      expect(result).toBe('http://localhost:5000')
    })

    it('should allow configured CORS_ORIGIN', async () => {
      await setupCorsWithEnv('development', 'https://plukd.xyz')

      const result = testOriginCallback('https://plukd.xyz')

      expect(result).toBe('https://plukd.xyz')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[cors] ✅ Allowing localhost/configured origin'
      )
    })

    it('should reject unknown origins', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('https://evil.com')

      expect(result).toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[cors] ❌ Rejecting origin')
    })

    it('should reject localhost without port', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('http://localhost')

      expect(result).toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[cors] ❌ Rejecting origin')
    })

    it('should reject https localhost', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const result = testOriginCallback('https://localhost:3001')

      expect(result).toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[cors] ❌ Rejecting origin')
    })

    it('should allow chrome extensions with various IDs', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      const extensions = [
        'chrome-extension://abc123',
        'chrome-extension://xyz789def456',
        'chrome-extension://extension-id-here',
      ]

      for (const ext of extensions) {
        const result = testOriginCallback(ext)
        expect(result).toBe(ext)
      }
    })

    it('should log all origin checks', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      testOriginCallback('chrome-extension://abc')
      testOriginCallback('http://localhost:3000')
      testOriginCallback('https://evil.com')

      // Should log 3 origin checks + 2 allow messages + 1 reject message = 6 calls
      expect(consoleLogSpy).toHaveBeenCalledTimes(6)
    })
  })

  // ===========================================================================
  // B. PRODUCTION MODE TESTS (5 tests)
  // ===========================================================================

  describe('Production Mode', () => {
    it('should only allow configured origin in production', async () => {
      const config = await setupCorsWithEnv('production', 'https://plukd.xyz')

      // Origin should be an array in production
      expect(Array.isArray(config.origin)).toBe(true)
      expect(config.origin).toEqual(['https://plukd.xyz'])
    })

    it('should reject chrome-extension origins in production', async () => {
      await setupCorsWithEnv('production', 'https://plukd.xyz')

      const result = testOriginCallback('chrome-extension://abc123')

      expect(result).toBeNull()
      // No console.log calls in production (origin is array, not function)
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should reject localhost in production', async () => {
      await setupCorsWithEnv('production', 'https://plukd.xyz')

      const result = testOriginCallback('http://localhost:3001')

      expect(result).toBeNull()
    })

    it('should reject unknown origins in production', async () => {
      await setupCorsWithEnv('production', 'https://plukd.xyz')

      const result = testOriginCallback('https://evil.com')

      expect(result).toBeNull()
    })

    it('should only match exact CORS_ORIGIN (no wildcards or subdomains)', async () => {
      const config = await setupCorsWithEnv('production', 'https://plukd.xyz')

      // Subdomain should not match
      expect(config.origin).toEqual(['https://plukd.xyz'])
      expect(config.origin).not.toContain('https://api.plukd.xyz')
      expect(config.origin).not.toContain('https://www.plukd.xyz')
    })
  })

  // ===========================================================================
  // C. HTTP CONFIGURATION TESTS (6 tests)
  // ===========================================================================

  describe('HTTP Configuration', () => {
    it('should have correct allowed methods', async () => {
      const config = await setupCorsWithEnv('development', 'http://localhost:3001')

      expect(config.allowMethods).toEqual([
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ])
    })

    it('should have correct allowed headers', async () => {
      const config = await setupCorsWithEnv('development', 'http://localhost:3001')

      expect(config.allowHeaders).toEqual(['Content-Type', 'Authorization'])
    })

    it('should enable credentials', async () => {
      const config = await setupCorsWithEnv('development', 'http://localhost:3001')

      expect(config.credentials).toBe(true)
    })

    it('should set max-age to 86400 seconds (24 hours)', async () => {
      const config = await setupCorsWithEnv('development', 'http://localhost:3001')

      expect(config.maxAge).toBe(86400)
    })

    it('should have origin callback function in development mode', async () => {
      const config = await setupCorsWithEnv('development', 'http://localhost:3001')

      expect(typeof config.origin).toBe('function')
    })

    it('should have origin array in production mode', async () => {
      const config = await setupCorsWithEnv('production', 'https://plukd.xyz')

      expect(Array.isArray(config.origin)).toBe(true)
    })
  })

  // ===========================================================================
  // D. SECURITY & EDGE CASES (7 tests)
  // ===========================================================================

  describe('Security & Edge Cases', () => {
    it('should allow origin that starts with localhost prefix', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // The CORS middleware uses startsWith('http://localhost:') which will match this
      // Note: In practice, 'http://localhost:3001.evil.com' is not a valid domain bypass
      // because browsers parse it as the domain 'localhost:3001.evil.com', not 'evil.com'
      const result = testOriginCallback('http://localhost:3001.evil.com')

      // This is allowed because it starts with 'http://localhost:'
      expect(result).toBe('http://localhost:3001.evil.com')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[cors] ✅ Allowing localhost/configured origin'
      )
    })

    it('should allow any localhost port in development', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // Any port should work with localhost: prefix
      const result = testOriginCallback('http://localhost:30010')

      expect(result).toBe('http://localhost:30010')
    })

    it('should handle uppercase protocol correctly', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // Browsers normalize URLs, but test the edge case
      const result = testOriginCallback('HTTP://localhost:3001')

      // JavaScript string comparison is case-sensitive
      expect(result).toBeNull()
    })

    it('should handle undefined origin gracefully', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // First-party requests may have undefined origin
      const result = testOriginCallback(undefined)

      expect(result).toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[cors] Request from origin:', undefined)
      expect(consoleLogSpy).toHaveBeenCalledWith('[cors] ❌ Rejecting origin')
    })

    it('should handle very long origin strings without performance issues', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // Create extremely long origin string (10KB)
      const longOrigin = 'chrome-extension://' + 'a'.repeat(10000)

      const start = Date.now()
      const result = testOriginCallback(longOrigin)
      const duration = Date.now() - start

      // Should complete quickly (< 10ms) and allow valid chrome extension
      expect(duration).toBeLessThan(10)
      expect(result).toBe(longOrigin)
    })

    it('should allow chrome-extension with additional path segments', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // Chrome extensions can have paths
      const result = testOriginCallback('chrome-extension://abc123/popup.html')

      // Should still allow because it starts with chrome-extension://
      expect(result).toBe('chrome-extension://abc123/popup.html')
    })

    it('should maintain consistent behavior across multiple calls', async () => {
      await setupCorsWithEnv('development', 'http://localhost:3001')

      // Call multiple times with same origin
      const results = [
        testOriginCallback('http://localhost:3000'),
        testOriginCallback('http://localhost:3000'),
        testOriginCallback('http://localhost:3000'),
      ]

      // All results should be identical
      expect(results[0]).toBe('http://localhost:3000')
      expect(results[1]).toBe('http://localhost:3000')
      expect(results[2]).toBe('http://localhost:3000')
    })
  })
})
