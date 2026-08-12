import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Proxmox node ID is required' })
    }

    const node = await prisma.proxmoxNode.findUnique({ where: { id } })
    if (!node) {
        throw createError({ statusCode: 404, statusMessage: 'Proxmox node not found' })
    }

    const body = await readBody<{
        name?: string
        host?: string
        port?: number
        token?: string
        siteId?: string | null
        isActive?: boolean
    }>(event)

    if (body.siteId) {
        const site = await prisma.site.findUnique({ where: { id: body.siteId } })
        if (!site) {
            throw createError({ statusCode: 400, statusMessage: 'Site not found' })
        }
    }

    const newHost = body.host || node.host
    const newPort = body.port !== undefined ? body.port : node.port
    if (newHost !== node.host || newPort !== node.port) {
        const existing = await prisma.proxmoxNode.findUnique({
            where: { host_port: { host: newHost, port: newPort } },
        })
        if (existing && existing.id !== id) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Another Proxmox node with this host and port already exists',
            })
        }
    }

    const updated = await prisma.proxmoxNode.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.host !== undefined && { host: body.host }),
            ...(body.port !== undefined && { port: body.port }),
            ...(body.token !== undefined && { token: body.token }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
            ...(body.siteId !== undefined && { siteId: body.siteId }),
        },
        include: { site: { select: { id: true, name: true } } },
    })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'UPDATE_PROXMOX',
            target: id,
            details: { name: updated.name },
            result: 'success',
        },
    })

    return {
        id: updated.id,
        name: updated.name,
        host: updated.host,
        port: updated.port,
        isActive: updated.isActive,
        siteId: updated.siteId,
        site: updated.site,
        updatedAt: updated.updatedAt,
    }
})
