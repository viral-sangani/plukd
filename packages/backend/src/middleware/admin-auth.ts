import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '../config/supabase'

/**
 * Admin authentication middleware.
 * Must be used AFTER authMiddleware to ensure user is authenticated.
 * Checks if the authenticated user has is_admin = true in the database.
 */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  if (!user.id) {
    throw new HTTPException(403, { message: 'User ID required for admin access' })
  }

  // Check if user has admin privileges in the database
  const { data: userData, error } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[admin-auth] Database error checking admin status:', error.message)
    throw new HTTPException(500, { message: 'Failed to verify admin access' })
  }

  if (!userData || !userData.is_admin) {
    console.warn(`[admin-auth] Unauthorized admin access attempt by user: ${user.id}`)
    throw new HTTPException(403, { message: 'Forbidden: Admin access required' })
  }

  await next()
}
