import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from './middleware/cors'
import { errorHandler } from './middleware/error-handler'
import { routes } from './routes'
import { env } from './config/env'
import { startWorker } from './jobs'

const app = new Hono()

// Start the bookmark processing worker
startWorker()

// Global middleware
app.use('*', logger())
app.use('*', cors())
app.onError(errorHandler)

// Root health check
app.get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'plukd-api',
    version: '0.1.0',
  })
)

// Mount API routes
app.route('/api', routes)

console.log(`[server] Starting on port ${env.PORT}`)

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
})

console.log(`[server] Listening on ${server.url}`)
