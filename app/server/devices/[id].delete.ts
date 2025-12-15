import prisma from '~/server/utils/prisma'

// DELETE /api/devices/[id] - Delete a device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    // Check if device exists
    const existing = await prisma.device.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device not found',
        })
    }

    // Delete the device (cascades to ports and sessions)
    await prisma.device.delete({ where: { id } })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'DELETE_DEVICE',
            target: id,
            details: { name: existing.name, type: existing.type },
            result: 'success',
        },
    })

    return { success: true, message: 'Device deleted successfully' }
})
