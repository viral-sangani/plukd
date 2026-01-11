import type { User } from '../../types'

/**
 * Factory function to create test user data with optional overrides
 */
export function createTestUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString()

  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    telegram_chat_id: null,
    telegram_username: null,
    telegram_linked_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

// Sample users in different states

export const basicUser: User = createTestUser({
  id: 'basic-user-1',
  email: 'basic@example.com',
  name: 'Basic User',
})

export const linkedTelegramUser: User = createTestUser({
  id: 'telegram-user-1',
  email: 'telegram@example.com',
  name: 'Telegram User',
  telegram_chat_id: '123456789',
  telegram_username: 'telegramuser',
  telegram_linked_at: new Date('2024-01-01').toISOString(),
})

export const userWithoutName: User = createTestUser({
  id: 'no-name-1',
  email: 'noname@example.com',
  name: null,
})

export const userWithoutAvatar: User = createTestUser({
  id: 'no-avatar-1',
  email: 'noavatar@example.com',
  name: 'No Avatar User',
  avatar_url: null,
})

export const minimalUser: User = createTestUser({
  id: 'minimal-1',
  email: 'minimal@example.com',
  name: null,
  avatar_url: null,
  telegram_chat_id: null,
  telegram_username: null,
  telegram_linked_at: null,
})

export const maximalUser: User = createTestUser({
  id: 'maximal-1',
  email: 'maximal@example.com',
  name: 'Maximal User With Very Long Name That Tests Edge Cases',
  avatar_url: 'https://example.com/avatar-very-long-url-path.jpg',
  telegram_chat_id: '987654321',
  telegram_username: 'maximaluser',
  telegram_linked_at: new Date('2024-01-01').toISOString(),
})
