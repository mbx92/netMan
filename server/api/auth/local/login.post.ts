import prisma from '../../../utils/prisma'
import { verifyPassword } from '../../../utils/password'
import { signLocalToken } from '../../../utils/local-auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = body.email?.trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required',
    })
  }

  const user = await prisma.appUser.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
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
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleName: user.roleName,
      provider: 'local' as const,
    },
    tokens: {
      accessToken,
      refreshToken,
      idToken: '',
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    },
  }
})
