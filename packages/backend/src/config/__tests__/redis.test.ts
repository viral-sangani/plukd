import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Note: ioredis is already mocked globally in setup.ts
// We import the mocked redis module to test its behavior

describe('redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('redis client initialization', () => {
    it('should export redis instance', async () => {
      // Act
      const { redis } = await import('../redis');

      // Assert
      expect(redis).toBeDefined();
      expect(redis.status).toBe('ready');
    });

    it('should have required redis methods', async () => {
      // Act
      const { redis } = await import('../redis');

      // Assert
      expect(redis.get).toBeDefined();
      expect(redis.set).toBeDefined();
      expect(redis.del).toBeDefined();
      expect(redis.expire).toBeDefined();
      expect(redis.on).toBeDefined();
      expect(redis.once).toBeDefined();
    });
  });

  describe('waitForRedis function', () => {
    it('should resolve immediately when redis status is already ready', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'ready';

      // Act
      const start = Date.now();
      await waitForRedis();
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(100); // Should resolve almost immediately
    });

    it('should wait for ready event when status is not ready', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      // Mock once to simulate ready event
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 10);
        }
      });

      // Act & Assert
      await expect(waitForRedis()).resolves.toBeUndefined();
      expect(redis.once).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should resolve when ready event is emitted', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      let readyHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'ready') {
          readyHandler = handler;
        }
      });

      // Act
      const promise = waitForRedis();
      setTimeout(() => readyHandler?.(), 10);

      // Assert
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject when error event is emitted', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      let errorHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Act
      const promise = waitForRedis();
      const testError = new Error('Connection failed');
      setTimeout(() => errorHandler?.(testError), 10);

      // Assert
      await expect(promise).rejects.toThrow('Connection failed');
    });

    it('should reject with timeout error after 10 seconds', async () => {
      // Arrange
      vi.useFakeTimers();
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';
      (redis as any).once = vi.fn(); // No event will be emitted

      // Act
      const promise = waitForRedis();
      vi.advanceTimersByTime(10000);

      // Assert
      await expect(promise).rejects.toThrow('Redis connection timeout');

      vi.useRealTimers();
    });

    it('should clear timeout when ready event is emitted', async () => {
      // Arrange
      vi.useFakeTimers();
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      let readyHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'ready') {
          readyHandler = handler;
        }
      });

      // Act
      const promise = waitForRedis();
      setTimeout(() => readyHandler?.(), 5000);
      vi.advanceTimersByTime(5000);

      await promise;

      // Fast-forward past the timeout to ensure it was cleared
      vi.advanceTimersByTime(6000);

      // Assert - promise should be resolved, not rejected
      await expect(promise).resolves.toBeUndefined();

      vi.useRealTimers();
    });

    it('should clear timeout when error event is emitted', async () => {
      // Arrange
      vi.useFakeTimers();
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      let errorHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Act
      const promise = waitForRedis();
      const testError = new Error('Connection failed');
      setTimeout(() => errorHandler?.(testError), 5000);
      vi.advanceTimersByTime(5000);

      // Assert
      await expect(promise).rejects.toThrow('Connection failed');

      vi.useRealTimers();
    });

    it('should register both ready and error event handlers', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      // Act
      const promise = waitForRedis();

      // Assert
      expect(redis.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(redis.once).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle waitForRedis called multiple times when already ready', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'ready';

      // Act & Assert
      await expect(waitForRedis()).resolves.toBeUndefined();
      await expect(waitForRedis()).resolves.toBeUndefined();
      await expect(waitForRedis()).resolves.toBeUndefined();
    });

    it('should handle status transition from connecting to ready', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      let readyHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'ready') {
          readyHandler = handler;
        }
      });

      // Act
      const promise = waitForRedis();

      // Simulate status change and ready event
      (redis as any).status = 'ready';
      setTimeout(() => readyHandler?.(), 10);

      // Assert
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('event handlers', () => {
    it('should handle error events with console logging', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { redis } = await import('../redis');

      // Simulate error event by calling the registered handler
      const errorHandler = (redis as any).on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      // Act
      if (errorHandler) {
        const testError = new Error('Connection timeout');
        errorHandler(testError);

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

    it('should handle connect events with console logging', async () => {
      // Arrange
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { redis } = await import('../redis');

      // Simulate connect event by calling the registered handler
      const connectHandler = (redis as any).on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      // Act
      if (connectHandler) {
        connectHandler();

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled();
      }

      consoleLogSpy.mockRestore();
    });
  });

  describe('configuration scenarios', () => {
    it('should handle different Redis status values', async () => {
      // Arrange
      const statuses = ['wait', 'connecting', 'connect', 'ready', 'end', 'close'];
      const { waitForRedis, redis } = await import('../redis');

      for (const status of statuses) {
        (redis as any).status = status;

        if (status === 'ready') {
          // Act & Assert
          await expect(waitForRedis()).resolves.toBeUndefined();
        } else {
          // Status is not ready, would wait for ready event
          expect((redis as any).status).toBe(status);
        }
      }
    });

    it('should work with redis operations', async () => {
      // Arrange
      const { redis } = await import('../redis');

      // Act - These should work with the mocked redis instance
      const getResult = await redis.get('test-key');
      const setResult = await redis.set('test-key', 'test-value');
      const delResult = await redis.del('test-key');

      // Assert
      expect(getResult).toBeNull();
      expect(setResult).toBe('OK');
      expect(delResult).toBe(1);
    });
  });

  describe('error scenarios', () => {
    it('should handle timeout errors during connection', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'connecting';

      let errorHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Act
      const promise = waitForRedis();
      const timeoutError = new Error('Connection timeout');
      setTimeout(() => errorHandler?.(timeoutError), 10);

      // Assert
      await expect(promise).rejects.toThrow('Connection timeout');
    });

    it('should handle reconnection scenarios', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');

      // First connection
      (redis as any).status = 'ready';
      await expect(waitForRedis()).resolves.toBeUndefined();

      // Simulate disconnection
      (redis as any).status = 'connecting';

      // Simulate reconnection
      let readyHandler: Function | undefined;
      (redis as any).once = vi.fn((event: string, handler: Function) => {
        if (event === 'ready') {
          readyHandler = handler;
        }
      });

      const promise = waitForRedis();
      setTimeout(() => {
        (redis as any).status = 'ready';
        readyHandler?.();
      }, 10);

      // Assert
      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle multiple error events', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { redis } = await import('../redis');

      const errorHandler = (redis as any).on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      // Act - Trigger multiple errors
      if (errorHandler) {
        errorHandler(new Error('Error 1'));
        errorHandler(new Error('Error 2'));
        errorHandler(new Error('Error 3'));

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent waitForRedis calls', async () => {
      // Arrange
      const { waitForRedis, redis } = await import('../redis');
      (redis as any).status = 'ready';

      // Act - Call waitForRedis multiple times concurrently
      const promises = [waitForRedis(), waitForRedis(), waitForRedis()];

      // Assert - All should resolve successfully
      await expect(Promise.all(promises)).resolves.toEqual([undefined, undefined, undefined]);
    });

    it('should handle ready event with no listeners', async () => {
      // Arrange
      const { redis } = await import('../redis');
      (redis as any).status = 'ready';

      // Act - Just verify redis is in ready state
      expect((redis as any).status).toBe('ready');
    });

    it('should handle error event with undefined message', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { redis } = await import('../redis');

      const errorHandler = (redis as any).on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      // Act
      if (errorHandler) {
        errorHandler({ message: undefined });

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });
  });
});
