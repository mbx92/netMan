import prisma from '../../utils/prisma'
import { agentManager } from '../../utils/agent-manager'
import { serializeAgentBigints } from '../../utils/serialize-agent'

// GET /api/agents - List all agents
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25))
    const shouldPaginate = query.page !== undefined || query.pageSize !== undefined
        || query.search !== undefined || query.status !== undefined || query.platform !== undefined
    const where: Record<string, unknown> = {}

    if (query.status && typeof query.status === 'string') {
        where.status = query.status
    }

    if (query.platform && typeof query.platform === 'string') {
        where.platform = query.platform
    }

    if (query.search && typeof query.search === 'string') {
        const search = query.search.trim()
        if (search) {
            const platformMatches = ['WINDOWS', 'LINUX', 'MACOS']
                .filter((platform) => platform.toLowerCase().includes(search.toLowerCase()))
                .map((platform) => ({ platform }))
            where.OR = [
                { alias: { contains: search, mode: 'insensitive' } },
                { hostname: { contains: search, mode: 'insensitive' } },
                { lastIp: { contains: search, mode: 'insensitive' } },
                { osVersion: { contains: search, mode: 'insensitive' } },
                { agentVersion: { contains: search, mode: 'insensitive' } },
                { device: { is: { name: { contains: search, mode: 'insensitive' } } } },
                { device: { is: { ip: { contains: search, mode: 'insensitive' } } } },
                ...platformMatches,
            ]
        }
    }

    const [agents, total] = await Promise.all([
        prisma.agent.findMany({
            where,
            orderBy: [{ status: 'asc' }, { hostname: 'asc' }],
            skip: shouldPaginate ? (page - 1) * pageSize : undefined,
            take: shouldPaginate ? pageSize : undefined,
            include: { device: { select: { id: true, name: true, ip: true, siteId: true } } },
        }),
        shouldPaginate ? prisma.agent.count({ where }) : Promise.resolve(0),
    ])

    const serialized = agents.map(({ enrollTokenHash, authKeyHash, vncPassword, ...agent }) => ({
        ...serializeAgentBigints(agent),
        isConnected: agentManager.isOnline(agent.id),
    }))

    if (shouldPaginate) {
        return {
            agents: serialized,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        }
    }

    return serialized
})
