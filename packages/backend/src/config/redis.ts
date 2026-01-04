import { Redis } from 'ioredis'
import { env } from './env'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
})

redis.on('error', (err) => {
  console.error('[redis] Connection error:', err.message)
})

redis.on('connect', () => {
  console.log('[redis] Connected successfully')
})

/**
 * Wait for Redis to be connected and ready.
 * This should be called before starting the BullMQ worker.
 */
export async function waitForRedis(): Promise<void> {
  if (redis.status === 'ready') {
    return
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout'))
    }, 10000)

    redis.once('ready', () => {
      clearTimeout(timeout)
      resolve()
    })

    redis.once('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}
