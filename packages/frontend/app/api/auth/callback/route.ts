import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')

  // Validate 'next' parameter to prevent open redirect vulnerabilities
  // Only allow relative paths starting with '/'
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/'

  if (!code) {
    // No code provided - redirect to error page
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Authentication failed - redirect to error page
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
  }

  // Authentication successful - determine redirect URL
  const isLocalhost = origin.includes('localhost')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // Force localhost redirect in development
  if (isLocalhost && appUrl) {
    // When accessed via localhost, always redirect to NEXT_PUBLIC_APP_URL
    return NextResponse.redirect(`${appUrl}${next}`)
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  // In development, use origin
  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // In production, prefer x-forwarded-host for proper HTTPS redirect behind proxy
  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  }

  // Fallback to origin
  return NextResponse.redirect(`${origin}${next}`)
}
