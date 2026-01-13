import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { adminAuthMiddleware } from '../../middleware/admin-auth'
import { adminStatsRoutes } from './stats'
import { processingRoutes } from './processing'
import { embeddingsRoutes } from './embeddings'
import { adminErrorsRoutes } from './errors'
import { aiSummariesRoutes } from './ai-summaries'

/**
 * Admin routes with authentication and admin role verification.
 *
 * All routes under /admin require:
 * 1. Valid JWT authentication (authMiddleware)
 * 2. Admin email verification (adminAuthMiddleware)
 *
 * Available sub-routes:
 * - /stats - Overview statistics
 * - /processing - Bookmark processing management
 * - /embeddings - Embedding generation management
 * - /errors - Error logs and debugging
 * - /ai-summaries - AI summaries management
 */
export const adminRoutes = new Hono()

// Apply authentication and admin middleware to all admin routes
adminRoutes.use('*', authMiddleware)
adminRoutes.use('*', adminAuthMiddleware)

// Mount sub-routes
adminRoutes.route('/stats', adminStatsRoutes)
adminRoutes.route('/processing', processingRoutes)
adminRoutes.route('/embeddings', embeddingsRoutes)
adminRoutes.route('/errors', adminErrorsRoutes)
adminRoutes.route('/ai-summaries', aiSummariesRoutes)
