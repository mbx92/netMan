import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Proxmox node ID is required' })
    }

    const node = await prisma.proxmoxNode.findUnique({
        where: { id },
        include: { site: { select: { id: true, name: true } } },
    })

    if (!node) {
        throw createError({ statusCode: 404, statusMessage: 'Proxmox node not found' })
    }

    return {
        id: node.id,
        name: node.name,
        host: node.host,
        port: node.port,
        isActive: node.isActive,
        lastSync: node.lastSync,
        lastSnapshot: node.lastSnapshot,
        siteId: node.siteId,
        site: node.site,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
    }
})
