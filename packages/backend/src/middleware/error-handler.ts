import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export function errorHandler(err: Error, c: Context) {
  console.error('[error]', err)

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation failed',
        details: err.issues,
      },
      400
    )
  }

  return c.json({ error: 'Internal server error' }, 500)
}
