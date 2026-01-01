import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../config/supabase'

export const userRoutes = new Hono()

// All routes require authentication
userRoutes.use('*', authMiddleware)

// GET / - Get current user profile
userRoutes.get('/', async (c) => {
  try {
    const authUser = c.get('user')

    // Fetch user profile from users table
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      // If user doesn't exist in users table yet, return basic auth user data
      if (error.code === 'PGRST116') {
        return c.json({
          id: authUser.id,
          email: authUser.email,
          name: null,
          avatar_url: null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      console.error('[user] Error fetching user:', error)
      return c.json({ error: 'Failed to fetch user profile' }, 500)
    }

    return c.json(user)
  } catch (error) {
    console.error('[user] Error in get:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
