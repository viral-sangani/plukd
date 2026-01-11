import { beforeEach, afterEach, vi } from 'vitest'

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
})

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks()
})

// Mock timers configuration
export const mockDateNow = (timestamp: number) => {
  vi.spyOn(Date, 'now').mockReturnValue(timestamp)
}

export const restoreDateNow = () => {
  vi.restoreAllMocks()
}
