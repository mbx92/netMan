import prisma from './prisma'
import { enrichIpam, normalizeIpv4 } from './ipam-enrich'
import type { ProxmoxGuest } from './proxmox'

function normalizeMac(mac?: string | null): string | null {
    if (!mac) return null
    const clean = mac.toLowerCase().replace(/[:-]/g, '')
    return clean.length === 12 ? clean : null
}

export type LinkedDevice = { id: string; created: boolean }

/**
 * Find a Device by IPv4 and update empty fields, or create one.
 * Does not overwrite existing name/type — so a pre-created inventory row is reused.
 */
export async function upsertDeviceByIp(opts: {
    ip: string
    name: string
    typeCode: string
    mac?: string | null
    hostname?: string | null
    siteId?: string | null
    parentDeviceId?: string | null
    notes?: string | null
}): Promise<LinkedDevice | null> {
    const ip = normalizeIpv4(opts.ip)
    if (!ip) return null

    const mac = normalizeMac(opts.mac)
    const existing = await prisma.device.findFirst({ where: { ip } })

    if (existing) {
        const data: Record<string, unknown> = {}
        if (opts.siteId && !existing.siteId) data.siteId = opts.siteId
        if (opts.hostname && !existing.hostname) data.hostname = opts.hostname
        if (mac && !existing.mac) data.mac = mac
        if (
            opts.parentDeviceId
            && !existing.parentDeviceId
            && existing.id !== opts.parentDeviceId
        ) {
            data.parentDeviceId = opts.parentDeviceId
        }
        if (opts.notes && !existing.notes) data.notes = opts.notes

        if (Object.keys(data).length) {
            try {
                await prisma.device.update({ where: { id: existing.id }, data })
            } catch {
                if (data.mac) {
                    delete data.mac
                    if (Object.keys(data).length) {
                        await prisma.device.update({ where: { id: existing.id }, data })
                    }
                }
            }
        }
        return { id: existing.id, created: false }
    }

    const createData = {
        name: opts.name,
        typeCode: opts.typeCode,
        ip,
        hostname: opts.hostname || null,
        siteId: opts.siteId || null,
        parentDeviceId: opts.parentDeviceId || null,
        notes: opts.notes || null,
        status: 'UNKNOWN' as const,
        isManaged: true,
    }

    try {
        const created = await prisma.device.create({
            data: { ...createData, mac },
        })
        return { id: created.id, created: true }
    } catch {
        if (!mac) return null
        const created = await prisma.device.create({ data: createData })
        return { id: created.id, created: true }
    }
}

export async function findDeviceByHost(host: string) {
    const ip = normalizeIpv4(host)
    return prisma.device.findFirst({
        where: ip ? { ip } : { OR: [{ ip: host }, { hostname: host }] },
        select: { id: true, name: true, ip: true, typeCode: true },
    })
}

/**
 * Link a Proxmox node (and its guests) to Devices + IPAM by IP.
 * Existing Device with the same IP is reused — not duplicated.
 */
export async function linkProxmoxInventory(opts: {
    host: string
    name: string
    siteId: string | null
    guests?: ProxmoxGuest[]
}): Promise<{
    hostDeviceId: string | null
    hostCreated: boolean
    guestsLinked: number
    guestsCreated: number
}> {
    const hostDevice = await upsertDeviceByIp({
        ip: opts.host,
        name: opts.name,
        typeCode: 'SERVER_LINUX',
        siteId: opts.siteId,
        notes: 'Proxmox VE host',
    })
    await enrichIpam(opts.siteId, opts.host, null, opts.name)

    let guestsLinked = 0
    let guestsCreated = 0
    const seen = new Set<string>()

    for (const guest of opts.guests || []) {
        const ip = guest.ipAddress || guest.networks?.find(n => n.ip)?.ip
        if (!ip) continue
        const key = normalizeIpv4(ip)
        if (!key || seen.has(key) || key === normalizeIpv4(opts.host)) continue
        seen.add(key)

        const linked = await upsertDeviceByIp({
            ip,
            name: guest.name,
            typeCode: 'VM',
            mac: guest.macAddress,
            hostname: guest.name,
            siteId: opts.siteId,
            parentDeviceId: hostDevice?.id || null,
            notes: `Proxmox ${guest.type === 'lxc' ? 'LXC' : 'VM'} (vmid ${guest.vmid})`,
        })
        await enrichIpam(opts.siteId, ip, guest.macAddress, guest.name)

        if (guest.networks) {
            for (const net of guest.networks) {
                if (net.ip && net.ip !== ip) {
                    await enrichIpam(opts.siteId, net.ip, net.mac, `${guest.name}-${net.name}`)
                }
            }
        }

        if (linked) {
            guestsLinked++
            if (linked.created) guestsCreated++
        }
    }

    return {
        hostDeviceId: hostDevice?.id || null,
        hostCreated: hostDevice?.created || false,
        guestsLinked,
        guestsCreated,
    }
}
