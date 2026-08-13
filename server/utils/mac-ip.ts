import prisma from './prisma'
import { getAllMikroTikClients } from './mikrotik'

export function normalizeMacKey(mac?: string | null): string | null {
    if (!mac) return null
    const clean = mac.toLowerCase().replace(/[^a-f0-9]/g, '')
    return clean.length === 12 ? clean : null
}

/**
 * MAC → IPv4 from IPAM (MikroTik sync), Devices, then live ARP.
 */
export async function buildMacIpMap(siteId?: string | null): Promise<Map<string, string>> {
    const map = new Map<string, string>()

    const allocs = await prisma.iPAllocation.findMany({
        where: { mac: { not: null } },
        select: { ip: true, mac: true },
    })
    for (const row of allocs) {
        const key = normalizeMacKey(row.mac)
        if (key && row.ip && !map.has(key)) map.set(key, row.ip)
    }

    const devices = await prisma.device.findMany({
        where: { mac: { not: null }, ip: { not: null } },
        select: { ip: true, mac: true },
    })
    for (const row of devices) {
        const key = normalizeMacKey(row.mac)
        if (key && row.ip && !map.has(key)) map.set(key, row.ip)
    }

    try {
        const clients = await getAllMikroTikClients()
        const preferred = siteId
            ? clients.filter(c => c.config.siteId === siteId)
            : clients
        const list = preferred.length ? preferred : clients
        for (const { client } of list) {
            try {
                const arp = await client.getArpTable()
                for (const entry of arp) {
                    const key = normalizeMacKey(entry['mac-address'])
                    const ip = entry.address
                    if (key && ip && !map.has(key)) map.set(key, ip)
                }
            } catch (error) {
                console.error('[MAC lookup] ARP failed:', (error as Error).message)
            }
        }
    } catch (error) {
        console.error('[MAC lookup] MikroTik clients failed:', (error as Error).message)
    }

    return map
}

export type GuestIpSource = 'config' | 'agent' | 'arp' | 'manual'

export function applyGuestIps<T extends {
    vmid: number
    type: string
    ipAddress?: string
    macAddress?: string
    ipSource?: GuestIpSource
}>(
    guests: T[],
    macMap: Map<string, string>,
    overrides: Record<string, string>,
): T[] {
    for (const guest of guests) {
        const override = overrides[String(guest.vmid)]
        if (override) {
            guest.ipAddress = override
            guest.ipSource = 'manual'
            continue
        }
        if (guest.ipAddress) {
            guest.ipSource = guest.type === 'lxc' ? 'config' : 'agent'
            continue
        }
        const key = normalizeMacKey(guest.macAddress)
        const fromArp = key ? macMap.get(key) : undefined
        if (fromArp) {
            guest.ipAddress = fromArp
            guest.ipSource = 'arp'
        }
    }
    return guests
}
