import prisma from '../../utils/prisma'

// DELETE /api/nas/:id - Delete NAS device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'NAS ID is required',
        })
    }

    // Check if device exists
    const device = await prisma.nAS.findUnique({
        where: { id },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'NAS device not found',
        })
    }

    // Delete the device
    await prisma.nAS.delete({
        where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_NAS',
            target: id,
            details: {
                name: device.name,
            },
            result: 'success',
        },
    })

    return {
        success: true,
        message: 'NAS device deleted successfully',
    }
})
