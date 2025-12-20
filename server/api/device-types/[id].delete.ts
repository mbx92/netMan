import prisma from '../../utils/prisma'

// DELETE /api/device-types/[id] - Soft delete a device type
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device type ID is required',
        })
    }

    // Check if device type exists
    const existing = await prisma.deviceType.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device type not found',
        })
    }

    // Check if any devices use this type
    const devicesCount = await prisma.device.count({
        where: { typeCode: existing.code }
    })
    if (devicesCount > 0) {
        throw createError({
            statusCode: 400,
            statusMessage: `Cannot delete device type: ${devicesCount} device(s) are using this type`,
        })
    }

    // Soft delete by setting isActive to false
    const deviceType = await prisma.deviceType.update({
        where: { id },
        data: { isActive: false },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_DEVICE_TYPE',
            target: deviceType.id,
            details: { code: deviceType.code },
            result: 'success',
        },
    })

    return { success: true, message: 'Device type deactivated' }
})
