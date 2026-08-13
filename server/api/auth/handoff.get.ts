import { consumeHandoff } from '../../utils/sso-handoff'

export default defineEventHandler(async (event) => {
  const payload = await consumeHandoff(event)
  if (!payload) {
    throw createError({
      statusCode: 401,
      statusMessage: 'SSO session handoff expired. Sign in again.',
    })
  }
  return payload
})
