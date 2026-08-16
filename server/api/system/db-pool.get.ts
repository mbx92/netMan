import prisma from '../../utils/prisma'

interface ActivityRow {
  pid: number
  state: string | null
  application_name: string | null
  client_addr: string | null
  query_start: Date | null
  state_change: Date | null
  wait_event_type: string | null
  wait_event: string | null
  query: string | null
}

// GET /api/system/db-pool - Prisma/Postgres connection pool status
export default defineEventHandler(async (event) => {
  const url = new URL(process.env.DATABASE_URL || '')
  const config = {
    connectionLimit: Number(url.searchParams.get('connection_limit')) || 5,
    poolTimeout: Number(url.searchParams.get('pool_timeout')) || 20,
    connectTimeout: Number(url.searchParams.get('connect_timeout')) || 10,
  }

  const [activity, maxConnRow] = await Promise.all([
    prisma.$queryRaw<ActivityRow[]>`
      SELECT pid, state, application_name, client_addr::text as client_addr,
             query_start, state_change, wait_event_type, wait_event,
             left(query, 200) as query
      FROM pg_stat_activity
      WHERE datname = current_database()
      ORDER BY state_change DESC NULLS LAST
    `,
    prisma.$queryRaw<{ max_connections: string }[]>`SHOW max_connections`,
  ])

  const byState = activity.reduce<Record<string, number>>((acc, row) => {
    const state = row.state || 'unknown'
    acc[state] = (acc[state] || 0) + 1
    return acc
  }, {})

  return {
    config,
    maxConnections: Number(maxConnRow[0]?.max_connections) || null,
    total: activity.length,
    byState,
    connections: activity,
  }
})
