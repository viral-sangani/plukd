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
