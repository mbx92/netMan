import prisma from '../../utils/prisma'
import { findDeviceByHost } from '../../utils/device-link'

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
        throw createError({
            statusCode: 404,
            statusMessage: 'Proxmox node not found',
        })
    }

    const linkedDevice = await findDeviceByHost(node.host)

    const snapshot = node.lastSnapshot as { virtualGuests?: { ipAddress?: string }[] } | null
    const guestIps = (snapshot?.virtualGuests || [])
        .map(g => g.ipAddress)
        .filter((ip): ip is string => !!ip)
    const guestDevices = guestIps.length
        ? await prisma.device.findMany({
            where: { ip: { in: guestIps } },
            select: { id: true, name: true, ip: true },
        })
        : []

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
        linkedDevice,
        guestDevices,
    }
})
