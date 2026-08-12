import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'User ID is required',
        })
    }

    const existing = await prisma.appUser.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        })
    }

    await prisma.appUser.delete({ where: { id } })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_USER',
            target: id,
            details: { email: existing.email, name: existing.name },
            result: 'success',
        },
    })

    return { success: true, message: 'User deleted' }
})
