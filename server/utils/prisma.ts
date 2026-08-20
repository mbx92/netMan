import { PrismaClient } from '@prisma/client'

/** Cap pool size so SSE + HMR don't exhaust remote Postgres */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '5')
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20')
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '10')
    }
    return url.toString()
  } catch {
    return raw
  }
}

const prismaClientSingleton = () => {
  const url = datasourceUrl()
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

/** Recreate the singleton if this process still holds a client generated
 *  before a newer model existed — otherwise plugins like metrics retention
 *  see `undefined.deleteMany`. */
const REQUIRED_DELEGATES = [
  'hikvisionDevice',
  'appUser',
  'agent',
  'agentMetricSample',
] as const

function isStalePrismaClient(client: object): boolean {
  return REQUIRED_DELEGATES.some(
    (key) => typeof (client as Record<string, unknown>)[key]?.deleteMany !== 'function',
  )
}

function getPrisma() {
  const existing = globalThis.prisma ?? prismaClientSingleton()
  if (isStalePrismaClient(existing)) {
    globalThis.prisma = prismaClientSingleton()
    return globalThis.prisma
  }
  if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = existing
  }
  return existing
}

export const prisma = getPrisma()

/** Run a Prisma call; on connection drop reconnect once and retry */
export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P1017' || code === 'P1001' || code === 'P1002') {
      try {
        await prisma.$disconnect()
      } catch {
        /* ignore */
      }
      await prisma.$connect()
      return await fn()
    }
    throw error
  }
}

export default prisma
