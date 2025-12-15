import prisma from '../../../utils/prisma'
import { pingHost } from '../../../utils/discovery'

// GET /api/devices/[id]/ports - Get all ports for a device with connected device info and status
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    // Get device with its ports and connected devices
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
                            type: true,
                            status: true,
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

    // Check ping status for each connected device
    const portsWithStatus = await Promise.all(
        device.ports.map(async (port) => {
            let pingStatus: 'online' | 'offline' | 'unknown' = 'unknown'

            if (port.connectedDevice?.ip) {
                try {
                    const result = await pingHost(port.connectedDevice.ip, 1000)
                    pingStatus = result.alive ? 'online' : 'offline'
                } catch {
                    pingStatus = 'offline'
                }
            }

            return {
                ...port,
                pingStatus,
            }
        })
    )

    return {
        device: {
            id: device.id,
            name: device.name,
            type: device.type,
            portCount: device.portCount,
        },
        ports: portsWithStatus,
    }
})
