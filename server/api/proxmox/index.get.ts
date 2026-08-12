import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = query.siteId as string | undefined
    const where = siteId ? { siteId } : {}

    const nodes = await prisma.proxmoxNode.findMany({
        where,
        include: {
            site: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
    })

    return {
        nodes: nodes.map((d) => ({
            id: d.id,
            name: d.name,
            host: d.host,
            port: d.port,
            isActive: d.isActive,
            lastSync: d.lastSync,
            siteId: d.siteId,
            site: d.site,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        })),
        total: nodes.length,
    }
})
