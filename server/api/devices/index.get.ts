import type { DeviceStatus, Prisma } from '@prisma/client'
import prisma from '../../utils/prisma'
import { loadConfigManagedHosts, resolveDeviceStatus } from '../../utils/device-presence'
import { agentManager } from '../../utils/agent-manager'

const DEVICE_STATUSES = new Set<DeviceStatus>(['ONLINE', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE'])

// GET /api/devices - List all devices with optional filters
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25))
    const shouldPaginate = query.page !== undefined || query.pageSize !== undefined

    const where: Prisma.DeviceWhereInput = {}

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

    const include = {
        deviceType: true,
        site: { select: { id: true, name: true } },
        agent: { select: { id: true, status: true, platform: true } },
        _count: {
            select: { ports: true, sessions: true }
        }
    } as const
    const orderBy = [
        { status: 'asc' as const },
        { name: 'asc' as const },
    ]
    const statusFilter = typeof query.status === 'string' && DEVICE_STATUSES.has(query.status as DeviceStatus)
        ? query.status as DeviceStatus
        : null

    if (!statusFilter) {
        const [devices, total, configHosts] = await Promise.all([
            prisma.device.findMany({
                where,
                orderBy,
                skip: shouldPaginate ? (page - 1) * pageSize : undefined,
                take: shouldPaginate ? pageSize : undefined,
                include,
            }),
            prisma.device.count({ where }),
            loadConfigManagedHosts(),
        ])

        return {
            devices: devices.map((device) => ({
                ...device,
                status: resolveDeviceStatus({
                    status: device.status,
                    agent: device.agent,
                    isApiActive: device.isApiActive,
                    ip: device.ip,
                    configHosts,
                }),
            })),
            total,
            page: shouldPaginate ? page : 1,
            pageSize: shouldPaginate ? pageSize : total,
            totalPages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
        }
    }

    const configHosts = await loadConfigManagedHosts()
    const effectiveWhere: Prisma.DeviceWhereInput = {
        AND: [where, presenceStatusWhere(statusFilter, configHosts)],
    }

    const [devices, total] = await Promise.all([
        prisma.device.findMany({
            where: effectiveWhere,
            orderBy,
            skip: shouldPaginate ? (page - 1) * pageSize : undefined,
            take: shouldPaginate ? pageSize : undefined,
            include,
        }),
        prisma.device.count({ where: effectiveWhere }),
    ])

    return {
        devices: devices.map((device) => ({
            ...device,
            status: resolveDeviceStatus({
                status: device.status,
                agent: device.agent,
                isApiActive: device.isApiActive,
                ip: device.ip,
                configHosts,
            }),
        })),
        total,
        page: shouldPaginate ? page : 1,
        pageSize: shouldPaginate ? pageSize : total,
        totalPages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    }
})

function presenceStatusWhere(status: DeviceStatus, configHosts: Set<string>): Prisma.DeviceWhereInput {
    if (status === 'MAINTENANCE') return { status: 'MAINTENANCE' }

    const onlineAgentIds = agentManager.getAll().map((agent) => agent.agentId)
    const configHostValues = Array.from(configHosts)
    const noAgent: Prisma.DeviceWhereInput = { agent: { is: null } }
    const onlineAgent: Prisma.DeviceWhereInput | null = onlineAgentIds.length > 0
        ? { agent: { is: { id: { in: onlineAgentIds } } } }
        : null
    const offlineAgent: Prisma.DeviceWhereInput = onlineAgentIds.length > 0
        ? { agent: { is: { id: { notIn: onlineAgentIds } } } }
        : { agent: { isNot: null } }

    const configManaged: Prisma.DeviceWhereInput | null = configHostValues.length > 0
        ? { ip: { in: configHostValues } }
        : null
    const notConfigManaged: Prisma.DeviceWhereInput = configHostValues.length > 0
        ? { OR: [{ ip: null }, { NOT: { ip: { in: configHostValues } } }] }
        : {}

    const nonMaintenance: Prisma.DeviceWhereInput = { status: { not: 'MAINTENANCE' } }
    if (status === 'ONLINE') {
        return {
            AND: [
                nonMaintenance,
                {
                    OR: [
                        ...(onlineAgent ? [onlineAgent] : []),
                        { ...noAgent, isApiActive: true },
                        { ...noAgent, isApiActive: false, status: 'ONLINE' },
                        ...(configManaged ? [{ ...noAgent, isApiActive: false, ...configManaged }] : []),
                    ],
                },
            ],
        }
    }

    if (status === 'OFFLINE') {
        return {
            AND: [
                nonMaintenance,
                {
                    OR: [
                        offlineAgent,
                        { ...noAgent, isApiActive: false, status: 'OFFLINE', ...notConfigManaged },
                    ],
                },
            ],
        }
    }

    return {
        AND: [
            nonMaintenance,
            { ...noAgent, isApiActive: false, status: 'UNKNOWN', ...notConfigManaged },
        ],
    }
}
