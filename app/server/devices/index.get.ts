import prisma from '~/server/utils/prisma'
import type { DeviceType, DeviceStatus } from '~/generated/prisma'

// GET /api/devices - List all devices with optional filters
export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const where: Record<string, unknown> = {}

    // Filter by type
    if (query.type && typeof query.type === 'string') {
        where.type = query.type as DeviceType
    }

    // Filter by status
    if (query.status && typeof query.status === 'string') {
        where.status = query.status as DeviceStatus
    }

    // Filter by location
    if (query.location && typeof query.location === 'string') {
        where.location = { contains: query.location, mode: 'insensitive' }
    }

    // Search by name, hostname, or IP
    if (query.search && typeof query.search === 'string') {
        where.OR = [
            { name: { contains: query.search, mode: 'insensitive' } },
            { hostname: { contains: query.search, mode: 'insensitive' } },
            { ip: { contains: query.search, mode: 'insensitive' } },
        ]
    }

    const devices = await prisma.device.findMany({
        where,
        orderBy: [
            { status: 'asc' },
            { name: 'asc' },
        ],
        include: {
            _count: {
                select: { ports: true, sessions: true }
            }
        }
    })

    return {
        devices,
        total: devices.length,
    }
})
