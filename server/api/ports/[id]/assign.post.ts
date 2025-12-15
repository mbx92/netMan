import prisma from '../../../utils/prisma'

interface AssignPortBody {
    connectedDeviceId: string | null  // null to unassign
}

// POST /api/ports/[id]/assign - Assign a device to a port
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<AssignPortBody>(event)

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

    // If assigning to a device, check it exists
    if (body.connectedDeviceId) {
        const device = await prisma.device.findUnique({
            where: { id: body.connectedDeviceId },
        })

        if (!device) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Connected device not found',
            })
        }
    }

    // Update port assignment
    const updatedPort = await prisma.networkPort.update({
        where: { id },
        data: {
            connectedDeviceId: body.connectedDeviceId,
        },
        include: {
            connectedDevice: {
                select: {
                    id: true,
                    name: true,
                    ip: true,
                    type: true,
                },
            },
        },
    })

    return {
        success: true,
        message: body.connectedDeviceId
            ? `Port assigned to ${updatedPort.connectedDevice?.name}`
            : 'Port assignment removed',
        port: updatedPort,
    }
})
