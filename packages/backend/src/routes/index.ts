import { Hono } from 'hono'
import { bookmarksRoutes } from './bookmarks'
import { telegramRoutes } from './telegram'
import { userRoutes } from './user'

export const routes = new Hono()

// Health check
routes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'plukd-api',
    timestamp: new Date().toISOString(),
  })
})

// Mount routes
routes.route('/bookmarks', bookmarksRoutes)
routes.route('/telegram', telegramRoutes)
routes.route('/user', userRoutes)
