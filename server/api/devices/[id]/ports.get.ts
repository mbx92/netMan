import prisma from '../../../utils/prisma'
import { agentReachability } from '../../../utils/device-presence'

// GET /api/devices/[id]/ports - Get all ports for a device with connected device info and status
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    const device = await prisma.device.findUnique({
        where: { id },
        include: {
            ports: {
                include: {
                    connectedDevice: {
                        select: {
                            id: true,
                            name: true,
                            ip: true,
                            typeCode: true,
                            status: true,
                            agent: { select: { id: true, status: true } },
                        },
                    },
                },
                orderBy: { portNumber: 'asc' },
            },
        },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device not found',
        })
    }

    const portsWithStatus = device.ports.map((port) => ({
        ...port,
        pingStatus: agentReachability(port.connectedDevice?.agent),
    }))

    return {
        device: {
            id: device.id,
            name: device.name,
            typeCode: device.typeCode,
            portCount: device.portCount,
        },
        ports: portsWithStatus,
    }
})
