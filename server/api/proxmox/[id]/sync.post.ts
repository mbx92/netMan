import prisma from '../../../utils/prisma'
import { createProxmoxClientById } from '../../../utils/proxmox'
import { linkProxmoxInventory } from '../../../utils/device-link'
import { applyGuestIps, buildMacIpMap } from '../../../utils/mac-ip'

type SnapshotBag = {
    virtualGuests?: Array<{
        vmid: number
        type: string
        ipAddress?: string
        macAddress?: string
        ipSource?: string
    }>
    guestIpOverrides?: Record<string, string>
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

    const client = await createProxmoxClientById(id)
    if (!client) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to create Proxmox client' })
    }

    try {
        const snapshot = await client.getFullSnapshot()
        const now = new Date()
        const prev = (node.lastSnapshot || {}) as SnapshotBag
        const overrides = prev.guestIpOverrides || {}

        const macMap = await buildMacIpMap(node.siteId)
        applyGuestIps(snapshot.virtualGuests, macMap, overrides)

        const snapshotToSave = {
            ...snapshot,
            guestIpOverrides: overrides,
        }

        console.log('[Proxmox] Sync nodes:', snapshot.nodes.length)
        console.log('[Proxmox] Sync guests:', snapshot.virtualGuests.length)

        await prisma.proxmoxNode.update({
            where: { id },
            data: {
                lastSync: now,
                lastSnapshot: snapshotToSave as unknown as Record<string, unknown>,
            },
        })

        let linked = { hostDeviceId: null as string | null, hostCreated: false, guestsLinked: 0, guestsCreated: 0 }
        try {
            linked = await linkProxmoxInventory({
                host: node.host,
                name: node.name,
                siteId: node.siteId,
                guests: snapshot.virtualGuests,
            })
        } catch (error) {
            console.error('[Proxmox] Device/IPAM link failed:', error)
        }

        const arpMatched = snapshot.virtualGuests.filter(g => g.ipSource === 'arp').length

        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_PROXMOX',
                target: id,
                details: {
                    name: node.name,
                    host: node.host,
                    nodes: snapshot.nodes.length,
                    guests: snapshot.virtualGuests.length,
                    storages: snapshot.storages.length,
                    backups: snapshot.backups.length,
                    arpMatched,
                },
                result: 'success',
            },
        })

        return {
            success: true,
            nodes: snapshot.nodes.length,
            guests: snapshot.virtualGuests.length,
            storages: snapshot.storages.length,
            backups: snapshot.backups.length,
            devices: linked,
            message: `Synced ${snapshot.virtualGuests.length} guests · ${arpMatched} IP matched from MikroTik ARP`,
        }
    } catch (error) {
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_PROXMOX',
                target: id,
                details: { error: (error as Error).message },
                result: 'failed',
            },
        })
        throw createError({
            statusCode: 500,
            statusMessage: `Sync failed: ${(error as Error).message}`,
        })
    }
})
