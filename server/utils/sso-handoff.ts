import { createHash } from 'node:crypto'
import { useSession } from 'h3'
import type { AuthTokens, User } from '../../app/types/auth'

const COOKIE_NAME = 'netman-sso-handoff'

function handoffPassword() {
  const secret = useRuntimeConfig().authSecret || 'netman-dev-secret-change-me'
  return createHash('sha256').update(`netman-handoff:${secret}`).digest('hex')
}

export function getHandoffSession(event: Parameters<typeof useSession>[0]) {
  return useSession(event, {
    name: COOKIE_NAME,
    password: handoffPassword(),
    maxAge: 120,
    cookie: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      path: '/',
    },
  })
}

export type HandoffPayload = {
  user: User
  tokens: AuthTokens
}

export async function writeHandoff(event: Parameters<typeof useSession>[0], payload: HandoffPayload) {
  const session = await getHandoffSession(event)
  await session.update(payload)
}

export async function consumeHandoff(event: Parameters<typeof useSession>[0]): Promise<HandoffPayload | null> {
  const session = await getHandoffSession(event)
  const user = session.data?.user as User | undefined
  const tokens = session.data?.tokens as AuthTokens | undefined
  await session.clear()
  if (!user || !tokens) return null
  return { user, tokens }
}
