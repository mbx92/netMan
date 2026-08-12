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

    await prisma.proxmoxNode.delete({ where: { id } })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_PROXMOX',
            target: id,
            details: { name: node.name, host: node.host },
            result: 'success',
        },
    })

    return { success: true }
})
