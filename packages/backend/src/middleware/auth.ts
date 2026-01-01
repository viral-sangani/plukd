import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as jose from 'jose'
import { env } from '../config/env'

export interface AuthUser {
  id: string
  email?: string
  role?: string
  aud: string
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

// Cache the JWKS for performance - Supabase uses asymmetric keys (ES256)
// See: https://supabase.com/docs/guides/auth/jwts
const PROJECT_JWKS = jose.createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.slice(7)

  try {
    // Use JWKS to verify ES256 tokens from Supabase
    const { payload } = await jose.jwtVerify(token, PROJECT_JWKS, {
      algorithms: ['ES256'],
    })

    if (!payload.sub) {
      throw new HTTPException(401, { message: 'Invalid token: missing subject' })
    }

    if (payload.role !== 'authenticated') {
      throw new HTTPException(401, { message: 'User not authenticated' })
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email as string | undefined,
      role: payload.role as string | undefined,
      aud: payload.aud as string,
    }

    c.set('user', user)
    await next()
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new HTTPException(401, { message: 'Token expired' })
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new HTTPException(401, { message: 'Invalid token' })
    }
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('[auth] Error:', error)
    throw new HTTPException(401, { message: 'Authentication failed' })
  }
}

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    await next()
    return
  }

  try {
    await authMiddleware(c, next)
  } catch {
    await next()
  }
}
