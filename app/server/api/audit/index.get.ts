import prisma from '~/server/utils/prisma'

// GET /api/audit - Get audit logs with filtering
export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const where: Record<string, unknown> = {}

    // Filter by actor
    if (query.actor && typeof query.actor === 'string') {
        where.actor = query.actor
    }

    // Filter by action
    if (query.action && typeof query.action === 'string') {
        where.action = query.action
    }

    // Filter by target
    if (query.target && typeof query.target === 'string') {
        where.target = query.target
    }

    // Filter by date range
    if (query.from && typeof query.from === 'string') {
        where.createdAt = { gte: new Date(query.from) }
    }

    const limit = parseInt(query.limit as string) || 50
    const offset = parseInt(query.offset as string) || 0

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.auditLog.count({ where }),
    ])

    return {
        logs,
        total,
        limit,
        offset,
    }
})
