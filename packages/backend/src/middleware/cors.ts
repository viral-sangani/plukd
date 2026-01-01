import { cors as honoCors } from 'hono/cors'
import { env } from '../config/env'

export function cors() {
  const origins =
    env.NODE_ENV === 'production'
      ? [env.CORS_ORIGIN]
      : ['http://localhost:3001', 'http://localhost:3000', env.CORS_ORIGIN]

  return honoCors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
}
