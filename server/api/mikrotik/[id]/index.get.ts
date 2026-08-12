import prisma from '../../../utils/prisma'

// GET /api/mikrotik/[id] - Get a single MikroTik device by ID
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID is required',
        })
    }

    const device = await prisma.mikrotikDevice.findUnique({
        where: { id },
        include: {
            site: {
                select: { id: true, name: true },
            },
        },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'MikroTik device not found',
        })
    }

    // Don't expose password
    return {
        id: device.id,
        name: device.name,
        host: device.host,
        port: device.port,
        username: device.username,
        apiVersion: device.apiVersion,
        isActive: device.isActive,
        lastSync: device.lastSync,
        lastSnapshot: device.lastSnapshot,
        siteId: device.siteId,
        site: device.site,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        hasCredentials: !!(device.username && device.password),
    }
})
