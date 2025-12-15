import prisma from '../../../utils/prisma'

// GET /api/devices/[id]/connected-to - Get which port this device is connected to
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    // Find the port where this device is connected
    const connectedPort = await prisma.networkPort.findFirst({
        where: {
            connectedDeviceId: id,
        },
        include: {
            device: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    ip: true,
                },
            },
        },
    })

    if (!connectedPort) {
        return { connectedToPort: null }
    }

    return {
        connectedToPort: {
            portId: connectedPort.id,
            portName: connectedPort.portName,
            portNumber: connectedPort.portNumber,
            device: connectedPort.device,
        },
    }
})
