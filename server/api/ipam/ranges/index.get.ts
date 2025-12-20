import prisma from '../../../utils/prisma'

// GET /api/ipam/ranges - List all IP ranges
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = query.siteId as string | undefined

    const where = siteId ? { siteId } : {}

    const ranges = await prisma.iPRange.findMany({
        where,
        include: {
            site: {
                select: { id: true, name: true }
            },
            _count: {
                select: { allocations: true }
            }
        },
        orderBy: { name: 'asc' }
    })

    // Parse network to get total IPs and usage
    const rangesWithStats = ranges.map(range => {
        const [, cidr] = range.network.split('/')
        const prefix = parseInt(cidr) || 24
        const totalIps = Math.pow(2, 32 - prefix) - 2 // Exclude network and broadcast

        return {
            id: range.id,
            name: range.name,
            network: range.network,
            gateway: range.gateway,
            vlan: range.vlan,
            description: range.description,
            siteId: range.siteId,
            site: range.site,
            totalIps,
            usedIps: range._count.allocations,
            freeIps: totalIps - range._count.allocations,
            usagePercent: totalIps > 0 ? Math.round((range._count.allocations / totalIps) * 100) : 0,
            createdAt: range.createdAt,
            updatedAt: range.updatedAt,
        }
    })

    return {
        ranges: rangesWithStats,
        total: rangesWithStats.length,
    }
})
