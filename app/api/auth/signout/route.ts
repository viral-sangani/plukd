import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  // Sign out the user - this clears the session cookies
  await supabase.auth.signOut()

  // Return a redirect response to the login page
  // Using 303 See Other to ensure the browser uses GET for the redirect
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), {
    status: 303,
  })
}
