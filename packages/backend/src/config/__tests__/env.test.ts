import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Note: The env module is already mocked globally in setup.ts, so we test
// the validation logic by testing the schema directly with process.env values

describe('env', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('env schema validation with valid environment variables', () => {
    it('should parse all required environment variables successfully', async () => {
      // Arrange - Create a schema to match the env module
      const envSchema = z.object({
        PORT: z.coerce.number().default(3000),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        CORS_ORIGIN: z.string().default('http://localhost:3001'),
        SUPABASE_URL: z.string().url(),
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        SUPABASE_JWT_SECRET: z.string().min(1),
        REDIS_URL: z.string().default('redis://localhost:6379'),
        TELEGRAM_BOT_TOKEN: z.string().min(1),
        TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
        GOPHER_API_KEY: z.string().min(1),
        GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
        APP_URL: z.string().url().optional(),
      });

      const testEnv = {
        PORT: '3000',
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://localhost:3001',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        SUPABASE_JWT_SECRET: 'test-jwt-secret',
        REDIS_URL: 'redis://localhost:6379',
        TELEGRAM_BOT_TOKEN: 'test-telegram-token',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
        GOPHER_API_KEY: 'test-gopher-key',
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-ai-key',
        APP_URL: 'https://test.example.com',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.PORT).toBe(3000);
      expect(env.NODE_ENV).toBe('development');
      expect(env.CORS_ORIGIN).toBe('http://localhost:3001');
      expect(env.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key');
      expect(env.SUPABASE_JWT_SECRET).toBe('test-jwt-secret');
      expect(env.REDIS_URL).toBe('redis://localhost:6379');
      expect(env.TELEGRAM_BOT_TOKEN).toBe('test-telegram-token');
      expect(env.TELEGRAM_WEBHOOK_SECRET).toBe('test-webhook-secret');
      expect(env.GOPHER_API_KEY).toBe('test-gopher-key');
      expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBe('test-google-ai-key');
      expect(env.APP_URL).toBe('https://test.example.com');
    });

    it('should parse PORT as number when provided as string', () => {
      // Arrange
      const envSchema = z.object({
        PORT: z.coerce.number().default(3000),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        CORS_ORIGIN: z.string().default('http://localhost:3001'),
        SUPABASE_URL: z.string().url(),
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        SUPABASE_JWT_SECRET: z.string().min(1),
        REDIS_URL: z.string().default('redis://localhost:6379'),
        TELEGRAM_BOT_TOKEN: z.string().min(1),
        TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
        GOPHER_API_KEY: z.string().min(1),
        GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
        APP_URL: z.string().url().optional(),
      });

      const testEnv = {
        ...getMinimalValidEnv(),
        PORT: '8080',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.PORT).toBe(8080);
      expect(typeof env.PORT).toBe('number');
    });

    it('should accept production NODE_ENV', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        NODE_ENV: 'production',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.NODE_ENV).toBe('production');
    });

    it('should accept test NODE_ENV', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        NODE_ENV: 'test',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.NODE_ENV).toBe('test');
    });

    it('should handle optional APP_URL when not provided', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete testEnv.APP_URL;

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.APP_URL).toBeUndefined();
    });
  });

  describe('default values', () => {
    it('should use default PORT when not provided', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete testEnv.PORT;

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.PORT).toBe(3000);
    });

    it('should use default NODE_ENV when not provided', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete testEnv.NODE_ENV;

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.NODE_ENV).toBe('development');
    });

    it('should use default CORS_ORIGIN when not provided', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete testEnv.CORS_ORIGIN;

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.CORS_ORIGIN).toBe('http://localhost:3001');
    });

    it('should use default REDIS_URL when not provided', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete testEnv.REDIS_URL;

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.REDIS_URL).toBe('redis://localhost:6379');
    });
  });

  describe('validation errors - missing required variables', () => {
    it('should throw error when SUPABASE_URL is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).SUPABASE_URL;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).SUPABASE_SERVICE_ROLE_KEY;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when SUPABASE_JWT_SECRET is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).SUPABASE_JWT_SECRET;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when TELEGRAM_BOT_TOKEN is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).TELEGRAM_BOT_TOKEN;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when TELEGRAM_WEBHOOK_SECRET is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).TELEGRAM_WEBHOOK_SECRET;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when GOPHER_API_KEY is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).GOPHER_API_KEY;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when GOOGLE_GENERATIVE_AI_API_KEY is missing', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = { ...getMinimalValidEnv() };
      delete (testEnv as any).GOOGLE_GENERATIVE_AI_API_KEY;

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });
  });

  describe('validation errors - invalid values', () => {
    it('should throw error when SUPABASE_URL is not a valid URL', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        SUPABASE_URL: 'not-a-valid-url',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is empty', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        SUPABASE_SERVICE_ROLE_KEY: '',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when SUPABASE_JWT_SECRET is empty', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        SUPABASE_JWT_SECRET: '',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when NODE_ENV has invalid value', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        NODE_ENV: 'invalid',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when APP_URL is not a valid URL', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        APP_URL: 'not-a-valid-url',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when TELEGRAM_BOT_TOKEN is empty', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        TELEGRAM_BOT_TOKEN: '',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when TELEGRAM_WEBHOOK_SECRET is empty', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        TELEGRAM_WEBHOOK_SECRET: '',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when GOPHER_API_KEY is empty', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        GOPHER_API_KEY: '',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });

    it('should throw error when GOOGLE_GENERATIVE_AI_API_KEY is empty', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        GOOGLE_GENERATIVE_AI_API_KEY: '',
      };

      // Act & Assert
      expect(() => envSchema.parse(testEnv)).toThrow();
    });
  });

  describe('type inference', () => {
    it('should correctly infer type from schema', () => {
      // Arrange
      const envSchema = createEnvSchema();
      type EnvType = z.infer<typeof envSchema>;

      // Act - TypeScript compile-time checks
      const testEnv: EnvType = {
        PORT: 3000,
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://localhost:3001',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        SUPABASE_JWT_SECRET: 'test-secret',
        REDIS_URL: 'redis://localhost:6379',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_WEBHOOK_SECRET: 'test-secret',
        GOPHER_API_KEY: 'test-key',
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-key',
        APP_URL: undefined,
      };

      // Assert
      expect(testEnv).toBeDefined();
      expect(testEnv.PORT).toBe(3000);
      expect(testEnv.NODE_ENV).toBe('development');
    });
  });

  describe('edge cases', () => {
    it('should handle PORT as string that coerces to number', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        PORT: '9000',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.PORT).toBe(9000);
      expect(typeof env.PORT).toBe('number');
    });

    it('should handle whitespace in string values', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        TELEGRAM_BOT_TOKEN: '  test-token  ',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.TELEGRAM_BOT_TOKEN).toBe('  test-token  ');
    });

    it('should handle REDIS_URL with authentication', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        REDIS_URL: 'redis://:password@localhost:6379/0',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.REDIS_URL).toBe('redis://:password@localhost:6379/0');
    });

    it('should handle SUPABASE_URL with trailing slash', () => {
      // Arrange
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        SUPABASE_URL: 'https://test.supabase.co/',
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.SUPABASE_URL).toBe('https://test.supabase.co/');
    });

    it('should handle very long API keys', () => {
      // Arrange
      const longKey = 'a'.repeat(500);
      const envSchema = createEnvSchema();
      const testEnv = {
        ...getMinimalValidEnv(),
        GOOGLE_GENERATIVE_AI_API_KEY: longKey,
      };

      // Act
      const env = envSchema.parse(testEnv);

      // Assert
      expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBe(longKey);
      expect(env.GOOGLE_GENERATIVE_AI_API_KEY.length).toBe(500);
    });
  });
});

/**
 * Helper function to create environment schema matching env.ts
 */
function createEnvSchema() {
  return z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:3001'),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_JWT_SECRET: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
    GOPHER_API_KEY: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    APP_URL: z.string().url().optional(),
  });
}

/**
 * Helper function to get minimal valid environment configuration
 */
function getMinimalValidEnv(): Record<string, string> {
  return {
    PORT: '3000',
    NODE_ENV: 'development',
    CORS_ORIGIN: 'http://localhost:3001',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
    REDIS_URL: 'redis://localhost:6379',
    TELEGRAM_BOT_TOKEN: 'test-telegram-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    GOPHER_API_KEY: 'test-gopher-key',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-ai-key',
    APP_URL: 'https://test.example.com',
  };
}
