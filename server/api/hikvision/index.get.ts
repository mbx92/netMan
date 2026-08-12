import prisma from '../../utils/prisma'

// GET /api/hikvision - List all Hikvision devices
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = query.siteId as string | undefined

    const where = siteId ? { siteId } : {}

    const devices = await prisma.hikvisionDevice.findMany({
        where,
        include: {
            site: {
                select: {
                    id: true,
                    name: true,
                },
            },
            _count: {
                select: { channels: true },
            },
        },
        orderBy: { name: 'asc' },
    })

    return {
        devices: devices.map(d => ({
            id: d.id,
            name: d.name,
            host: d.host,
            port: d.port,
            username: d.username,
            protocol: d.protocol,
            deviceType: d.deviceType,
            model: d.model,
            serialNumber: d.serialNumber,
            macAddress: d.macAddress,
            firmware: d.firmware,
            isActive: d.isActive,
            lastSync: d.lastSync,
            siteId: d.siteId,
            site: d.site,
            channelCount: d._count.channels,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        })),
        total: devices.length,
    }
})
