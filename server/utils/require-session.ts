import { getHeader, createError, type H3Event } from 'h3'
import { verifyLocalToken } from './local-auth'

/** JWT from the browser $fetch plugin. Used to keep installer downloads off the public login page. */
export async function requireSession(event: H3Event) {
  const header = getHeader(event, 'authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  try {
    await verifyLocalToken(token, 'access')
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
}
