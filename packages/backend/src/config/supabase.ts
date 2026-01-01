import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@plukd/shared'

export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
