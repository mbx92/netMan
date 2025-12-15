import prisma from '../../../utils/prisma'

// DELETE /api/ports/[id] - Delete a port
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Port ID is required',
        })
    }

    // Check port exists
    const port = await prisma.networkPort.findUnique({
        where: { id },
    })

    if (!port) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Port not found',
        })
    }

    // Delete the port
    await prisma.networkPort.delete({
        where: { id },
    })

    // Update device port count
    const remainingPorts = await prisma.networkPort.count({
        where: { deviceId: port.deviceId },
    })

    await prisma.device.update({
        where: { id: port.deviceId },
        data: { portCount: remainingPorts },
    })

    return {
        success: true,
        message: `Port ${port.portName} deleted`,
    }
})
