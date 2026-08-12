import prisma from '../../utils/prisma'

// GET /api/hikvision/[id] - Get Hikvision device details with channels
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Hikvision device ID is required',
        })
    }

    const device = await prisma.hikvisionDevice.findUnique({
        where: { id },
        include: {
            site: {
                select: { id: true, name: true },
            },
            channels: {
                orderBy: { channelIndex: 'asc' },
            },
        },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Hikvision device not found',
        })
    }

    return {
        id: device.id,
        name: device.name,
        host: device.host,
        port: device.port,
        username: device.username,
        protocol: device.protocol,
        deviceType: device.deviceType,
        model: device.model,
        serialNumber: device.serialNumber,
        macAddress: device.macAddress,
        firmware: device.firmware,
        isActive: device.isActive,
        lastSync: device.lastSync,
        lastSnapshot: device.lastSnapshot,
        siteId: device.siteId,
        site: device.site,
        channels: device.channels,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
    }
})
