import prisma from '../../utils/prisma'

// POST /api/notifications/mark-all-read - Bulk mark all unread notifications as read
export default defineEventHandler(async () => {
    const result = await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true, readAt: new Date() },
    })

    return { success: true, count: result.count }
})
