import prisma from '../../utils/prisma'

// GET /api/mikrotik - List all MikroTik devices
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = query.siteId as string | undefined

    const where = siteId ? { siteId } : {}

    const devices = await prisma.mikrotikDevice.findMany({
        where,
        include: {
            site: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    })

    // Don't expose passwords in list
    return {
        devices: devices.map(d => ({
            id: d.id,
            name: d.name,
            host: d.host,
            port: d.port,
            username: d.username,
            apiVersion: d.apiVersion,
            isActive: d.isActive,
            lastSync: d.lastSync,
            siteId: d.siteId,
            site: d.site,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        })),
        total: devices.length,
    }
})
