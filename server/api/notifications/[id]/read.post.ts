import prisma from '../../../utils/prisma'

// POST /api/notifications/[id]/read - Mark a single notification as read
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Notification ID is required' })
    }

    const notification = await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
    })

    return { success: true, notification }
})
