import { SignJWT, jwtVerify } from 'jose'

export type LocalTokenKind = 'access' | 'refresh'

function getSecret() {
  const secret = useRuntimeConfig().authSecret
  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'AUTH_SECRET is not configured',
    })
  }
  return new TextEncoder().encode(secret)
}

export async function signLocalToken(payload: {
  sub: string
  email: string
  name: string
  roleName?: string
  kind: LocalTokenKind
}) {
  const expiresIn = payload.kind === 'access' ? '8h' : '7d'
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    roleName: payload.roleName || 'admin',
    kind: payload.kind,
    provider: 'local',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyLocalToken(token: string, kind?: LocalTokenKind) {
  const { payload } = await jwtVerify(token, getSecret())
  if (kind && payload.kind !== kind) {
    throw new Error('Invalid token kind')
  }
  return payload
}
