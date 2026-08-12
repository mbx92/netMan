import prisma from '../../../utils/prisma'
import { createProxmoxClientById } from '../../../utils/proxmox'

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

        console.log('[Proxmox] Sync nodes:', snapshot.nodes.length)
        console.log('[Proxmox] Sync guests:', snapshot.virtualGuests.length)
        console.log('[Proxmox] Sync storages:', snapshot.storages.length)
        console.log('[Proxmox] Sync networks:', snapshot.network.length)
        console.log('[Proxmox] Sync backups:', snapshot.backups.length)

        await prisma.proxmoxNode.update({
            where: { id },
            data: {
                lastSync: now,
                lastSnapshot: snapshot as unknown as Record<string, unknown>,
            },
        })

        // Enrich IPAM for discovered VMs/LXCs with IPs
        for (const guest of snapshot.virtualGuests) {
            if (guest.ipAddress) {
                await enrichIpam(node.siteId, guest.ipAddress, guest.macAddress, guest.name)
            }
            // Also check per-network interfaces
            if (guest.networks) {
                for (const net of guest.networks) {
                    if (net.ip && net.ip !== guest.ipAddress) {
                        await enrichIpam(node.siteId, net.ip, net.mac, `${guest.name}-${net.name}`)
                    }
                }
            }
        }

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
            message: `Synced ${snapshot.nodes.length} nodes, ${snapshot.virtualGuests.length} virtual guests, ${snapshot.storages.length} storages, ${snapshot.backups.length} backups`,
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

async function enrichIpam(
    siteId: string | null,
    ip: string,
    mac: string | undefined,
    hostname: string,
): Promise<void> {
    if (!siteId) return

    const ranges = await prisma.iPRange.findMany({ where: { siteId } })
    const matchingRange = ranges.find((range) => ipInCidr(ip, range.network))
    if (!matchingRange) return

    const existing = await prisma.iPAllocation.findUnique({
        where: { rangeId_ip: { rangeId: matchingRange.id, ip } },
    })

    if (existing) {
        const data: Record<string, unknown> = {}
        if (!existing.hostname && hostname) data.hostname = hostname
        if (!existing.mac && mac) data.mac = mac
        if (Object.keys(data).length > 0) {
            await prisma.iPAllocation.update({ where: { id: existing.id }, data })
        }
    } else {
        await prisma.iPAllocation.create({
            data: {
                rangeId: matchingRange.id,
                ip,
                mac: mac || null,
                hostname: hostname || null,
                type: 'STATIC',
            },
        })
    }
}

function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function ipInCidr(ip: string, cidr: string): boolean {
    const [network, bits] = cidr.split('/')
    const mask = parseInt(bits, 10)
    if (Number.isNaN(mask) || mask < 0 || mask > 32) return false
    const ipLong = ipToLong(ip)
    const netLong = ipToLong(network)
    const maskLong = (0xFFFFFFFF << (32 - mask)) >>> 0
    return (ipLong & maskLong) === (netLong & maskLong)
}
