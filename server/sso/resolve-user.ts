import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import prisma from '../utils/prisma.ts'
import { hashPassword } from '../utils/password.ts'
import { signLocalToken } from '../utils/local-auth.ts'
import { writeHandoff } from '../utils/sso-handoff.ts'

type SsoUserInfo = {
  sub?: string
  email?: string
  name?: string
  employee_id?: string
  department?: string
  position?: string
  avatar_url?: string
  role_id?: string
  role_name?: string
}

function mapRole(roleName?: string) {
  const role = String(roleName || '').toLowerCase()
  if (role === 'superadmin' || role === 'admin') return 'admin'
  if (role) return role
  return 'user'
}

/**
 * Map SSO userinfo → NetMan AppUser + short-lived handoff cookie.
 * Called by @mbx92/nuxt-sso-client after token exchange.
 */
export default async function resolveSsoUser(
  event: unknown,
  { userInfo, sso }: { userInfo: SsoUserInfo; tokens?: unknown; sso: { autoProvision?: boolean } },
) {
  const email = String(userInfo.email || '').toLowerCase().trim()
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'SSO tidak mengembalikan email' })
  }

  let user = await prisma.appUser.findUnique({ where: { email } })

  if (!user && sso.autoProvision) {
    user = await prisma.appUser.create({
      data: {
        email,
        name: userInfo.name || email,
        passwordHash: await hashPassword(randomUUID()),
        roleName: mapRole(userInfo.role_name),
        isActive: true,
      },
    })
  }

  if (!user || !user.isActive) {
    throw createError({
      statusCode: 403,
      statusMessage: `User ${email} belum terdaftar di NetMan`,
    })
  }

  if (userInfo.name && userInfo.name !== user.name) {
    user = await prisma.appUser.update({
      where: { id: user.id },
      data: { name: userInfo.name },
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

  await writeHandoff(event as Parameters<typeof writeHandoff>[0], {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      employeeId: userInfo.employee_id,
      department: userInfo.department,
      position: userInfo.position,
      avatarUrl: userInfo.avatar_url,
      roleId: userInfo.role_id,
      roleName: user.roleName,
      provider: 'sso',
    },
    tokens: {
      accessToken,
      refreshToken,
      idToken: '',
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    },
  })

  await prisma.auditLog.create({
    data: {
      actor: user.email,
      action: 'LOGIN_SSO',
      target: user.id,
      details: { email: user.email, ssoSub: userInfo.sub },
      result: 'success',
    },
  })

  return { redirectTo: '/auth/callback' }
}
