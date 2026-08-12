import prisma from '../../utils/prisma'

// DELETE /api/hikvision/[id] - Delete a Hikvision device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Hikvision device ID is required',
        })
    }

    const existing = await prisma.hikvisionDevice.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Hikvision device not found',
        })
    }

    await prisma.hikvisionDevice.delete({ where: { id } })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_HIKVISION',
            target: id,
            details: { name: existing.name, host: existing.host },
            result: 'success',
        },
    })

    return { success: true, message: 'Hikvision device deleted' }
})
