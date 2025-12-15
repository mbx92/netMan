import prisma from '~/server/utils/prisma'

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
            ports: {
                orderBy: { portName: 'asc' }
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
