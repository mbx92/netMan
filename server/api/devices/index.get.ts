import prisma from '../../utils/prisma'
import { loadConfigManagedHosts, resolveDeviceStatus } from '../../utils/device-presence'

// GET /api/devices - List all devices with optional filters
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25))
    const shouldPaginate = query.page !== undefined || query.pageSize !== undefined

    const where: Record<string, unknown> = {}

    // Filter by type code
    if (query.type && typeof query.type === 'string') {
        where.typeCode = query.type
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

    const [devices, configHosts] = await Promise.all([
        prisma.device.findMany({
            where,
            orderBy: [
                { status: 'asc' },
                { name: 'asc' },
            ],
            include: {
                deviceType: true,
                site: { select: { id: true, name: true } },
                agent: { select: { id: true, status: true, platform: true } },
                _count: {
                    select: { ports: true, sessions: true }
                }
            }
        }),
        loadConfigManagedHosts(),
    ])

    const withPresence = devices.map((device) => ({
        ...device,
        status: resolveDeviceStatus({
            status: device.status,
            agent: device.agent,
            isApiActive: device.isApiActive,
            ip: device.ip,
            configHosts,
        }),
    }))

    const statusFilter = typeof query.status === 'string' ? query.status : ''
    const filtered = statusFilter
        ? withPresence.filter((device) => device.status === statusFilter)
        : withPresence
    const total = filtered.length
    const paged = shouldPaginate
        ? filtered.slice((page - 1) * pageSize, page * pageSize)
        : filtered

    return {
        devices: paged,
        total,
        page: shouldPaginate ? page : 1,
        pageSize: shouldPaginate ? pageSize : total,
        totalPages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    }
})
