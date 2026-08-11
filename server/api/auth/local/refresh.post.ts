import prisma from '../../../utils/prisma'
import { signLocalToken, verifyLocalToken } from '../../../utils/local-auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ refreshToken?: string }>(event)
  if (!body.refreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'refreshToken is required',
    })
  }

  let payload
  try {
    payload = await verifyLocalToken(body.refreshToken, 'refresh')
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid refresh token',
    })
  }

  const userId = payload.sub
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid refresh token' })
  }

  const user = await prisma.appUser.findUnique({ where: { id: userId } })
  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  const accessToken = await signLocalToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    roleName: user.roleName,
    kind: 'access',
  })
  const refreshToken = await signLocalToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    roleName: user.roleName,
    kind: 'refresh',
  })

  return {
    accessToken,
    refreshToken,
    idToken: '',
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  }
})
