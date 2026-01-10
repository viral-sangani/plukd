import { cors as honoCors } from 'hono/cors'
import { env } from '../config/env'

export function cors() {
  // In development, allow chrome-extension:// origins for extension testing
  if (env.NODE_ENV === 'development') {
    return honoCors({
      origin: (origin) => {
        console.log('[cors] Request from origin:', origin)

        // Allow chrome extensions in development
        if (origin?.startsWith('chrome-extension://')) {
          console.log('[cors] ✅ Allowing chrome extension origin')
          return origin
        }

        // Allow localhost origins
        if (
          origin?.startsWith('http://localhost:') ||
          origin === env.CORS_ORIGIN
        ) {
          console.log('[cors] ✅ Allowing localhost/configured origin')
          return origin
        }

        console.log('[cors] ❌ Rejecting origin')
        return null
      },
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    })
  }

  // Production: Only allow configured origin
  return honoCors({
    origin: [env.CORS_ORIGIN],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
}
