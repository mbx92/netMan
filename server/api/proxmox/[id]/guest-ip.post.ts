import prisma from '../../../utils/prisma'
import { enrichIpam, normalizeIpv4 } from '../../../utils/ipam-enrich'
import { findDeviceByHost, upsertDeviceByIp } from '../../../utils/device-link'

type SnapshotBag = {
    virtualGuests?: Array<{
        vmid: number
        name: string
        type: string
        ipAddress?: string
        macAddress?: string
        ipSource?: string
        networks?: { name: string; ip?: string; mac?: string }[]
    }>
    guestIpOverrides?: Record<string, string>
    [key: string]: unknown
}

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Proxmox node ID is required' })
    }

    const node = await prisma.proxmoxNode.findUnique({ where: { id } })
    if (!node) {
        throw createError({ statusCode: 404, statusMessage: 'Proxmox node not found' })
    }

    const body = await readBody<{ vmid?: number; ip?: string | null }>(event)
    const vmid = Number(body.vmid)
    if (!Number.isFinite(vmid) || vmid <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'vmid is required' })
    }

    const ip = body.ip === null || body.ip === '' || body.ip === undefined
        ? null
        : normalizeIpv4(body.ip)
    if (body.ip && !ip) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid IPv4 address' })
    }

    const snapshot = (node.lastSnapshot || {}) as SnapshotBag
    const guests = snapshot.virtualGuests || []
    const guest = guests.find(g => g.vmid === vmid)
    if (!guest) {
        throw createError({ statusCode: 404, statusMessage: `Guest ${vmid} not found in last snapshot. Sync first.` })
    }

    const overrides = { ...(snapshot.guestIpOverrides || {}) }
    if (ip) overrides[String(vmid)] = ip
    else delete overrides[String(vmid)]

    guest.ipAddress = ip || undefined
    guest.ipSource = ip ? 'manual' : undefined

    snapshot.guestIpOverrides = overrides
    snapshot.virtualGuests = guests

    await prisma.proxmoxNode.update({
        where: { id },
        data: { lastSnapshot: snapshot as Record<string, unknown> },
    })

    if (ip) {
        const hostDevice = await findDeviceByHost(node.host)
        await upsertDeviceByIp({
            ip,
            name: guest.name,
            typeCode: 'VM',
            mac: guest.macAddress,
            hostname: guest.name,
            siteId: node.siteId,
            parentDeviceId: hostDevice?.id || null,
            notes: `Proxmox ${guest.type === 'lxc' ? 'LXC' : 'VM'} (vmid ${guest.vmid})`,
        })
        await enrichIpam(node.siteId, ip, guest.macAddress, guest.name)
    }

    return {
        success: true,
        vmid,
        ip,
        guest,
    }
})
