import prisma from '../../utils/prisma'

// GET /api/devices/[id] - Get single device with full details
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
            deviceType: true,
            site: true,
            parentDevice: { select: { id: true, name: true, ip: true, typeCode: true } },  // Parent host for VMs
            childDevices: { select: { id: true, name: true, ip: true, typeCode: true } },  // Child VMs
            ports: {
                orderBy: { portName: 'asc' },
                include: {
                    connectedDevice: {
                        select: { id: true, name: true, ip: true, typeCode: true }
                    }
                }
            },
            sessions: {
                orderBy: { startedAt: 'desc' },
                take: 10,
            },
        },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device not found',
        })
    }

    return device
})
