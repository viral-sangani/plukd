/**
 * Vitest setup file for backend tests
 *
 * This file runs before all tests and sets up mocks for external services.
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment config module FIRST to avoid validation errors
vi.mock('../config/env', () => ({
  env: {
    PORT: 3000,
    NODE_ENV: 'test' as const,
    CORS_ORIGIN: 'http://localhost:3001',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
    REDIS_URL: 'redis://localhost:6379',
    TELEGRAM_BOT_TOKEN: 'test-telegram-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    GOPHER_API_KEY: 'test-gopher-key',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-ai-key',
    PARALLEL_API_KEY: 'test-parallel-key',
    APP_URL: 'https://test.example.com',
  },
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

// Mock Redis/ioredis
vi.mock('ioredis', () => {
  const MockRedis = vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    on: vi.fn(),
  }));
  return { default: MockRedis };
});

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
  })),
  Worker: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Grammy (Telegram bot)
vi.mock('grammy', () => ({
  Bot: vi.fn(() => ({
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      setWebhook: vi.fn().mockResolvedValue(true),
      deleteWebhook: vi.fn().mockResolvedValue(true),
    },
    handleUpdate: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    use: vi.fn(),
    command: vi.fn(),
    on: vi.fn(),
  })),
  webhookCallback: vi.fn(() => vi.fn()),
}));

// Mock AI SDK
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => ({
    chat: vi.fn(),
  })),
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Mock AI response',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }),
  generateObject: vi.fn().mockResolvedValue({
    object: {},
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }),
  embed: vi.fn().mockResolvedValue({
    embedding: new Array(768).fill(0),
    usage: { tokens: 10 },
  }),
}));

// Mock environment variables
beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  vi.stubEnv('SUPABASE_JWT_SECRET', 'test-jwt-secret');
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-telegram-token');
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'test-webhook-secret');
  vi.stubEnv('GOPHER_API_KEY', 'test-gopher-key');
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-google-ai-key');
  vi.stubEnv('PARALLEL_API_KEY', 'test-parallel-key');
  vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
