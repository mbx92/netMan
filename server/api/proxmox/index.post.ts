import prisma from '../../utils/prisma'
import { ProxmoxClient } from '../../utils/proxmox'

export default defineEventHandler(async (event) => {
    const body = await readBody<{
        name: string
        host: string
        port?: number
        token: string
        siteId?: string
        testConnection?: boolean
    }>(event)

    if (!body.name || !body.host || !body.token) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name, host, and token are required',
        })
    }

    const port = body.port || 8006

    const existing = await prisma.proxmoxNode.findUnique({
        where: { host_port: { host: body.host, port } },
    })
    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'Proxmox node with this host and port already exists',
        })
    }

    if (body.siteId) {
        const site = await prisma.site.findUnique({ where: { id: body.siteId } })
        if (!site) {
            throw createError({ statusCode: 400, statusMessage: 'Site not found' })
        }
    }

    if (body.testConnection) {
        const client = new ProxmoxClient({
            host: body.host,
            port,
            token: body.token,
        })
        const ok = await client.testConnection()
        if (!ok) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Failed to connect. Check host, token, and SSL certificate.',
            })
        }
    }

    const node = await prisma.proxmoxNode.create({
        data: {
            name: body.name,
            host: body.host,
            port,
            token: body.token,
            siteId: body.siteId || null,
        },
        include: { site: { select: { id: true, name: true } } },
    })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_PROXMOX',
            target: node.id,
            details: { name: node.name, host: node.host },
            result: 'success',
        },
    })

    return {
        id: node.id,
        name: node.name,
        host: node.host,
        port: node.port,
        isActive: node.isActive,
        siteId: node.siteId,
        site: node.site,
        createdAt: node.createdAt,
    }
})
