import prisma from '../../utils/prisma'

// GET /api/notifications - Get notifications, paginated
export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const where: Record<string, unknown> = {}
    if (query.unreadOnly === 'true') {
        where.isRead = false
    }

    const limit = parseInt(query.limit as string) || 20
    const offset = parseInt(query.offset as string) || 0

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { isRead: false } }),
    ])

    return {
        notifications,
        total,
        unreadCount,
        limit,
        offset,
    }
})
