import prisma from './prisma'

export type IpamEnrichResult = 'created' | 'updated' | 'unchanged' | 'skipped'

function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

export function ipInCidr(ip: string, cidr: string): boolean {
    const [network, bits] = String(cidr || '').split('/')
    const mask = parseInt(bits, 10)
    if (!network || Number.isNaN(mask) || mask < 0 || mask > 32) return false
    const ipLong = ipToLong(ip)
    const netLong = ipToLong(network)
    const maskLong = (0xFFFFFFFF << (32 - mask)) >>> 0
    return (ipLong & maskLong) === (netLong & maskLong)
}

export function normalizeIpv4(raw?: string | null): string | null {
    if (!raw) return null
    const s = String(raw).trim().split(/[,\s]/)[0] || ''
    const bare = s.replace(/\/\d+$/, '')
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return null
    const parts = bare.split('.').map(Number)
    if (parts.some(n => n > 255)) return null
    return parts.join('.')
}

/**
 * Create or enrich an IPAM allocation for an IP.
 * Prefers a range on the same site, then any matching CIDR range.
 */
export async function enrichIpam(
    siteId: string | null | undefined,
    ipRaw: string | null | undefined,
    mac: string | null | undefined,
    hostname: string | null | undefined,
): Promise<IpamEnrichResult> {
    const ip = normalizeIpv4(ipRaw)
    if (!ip) return 'skipped'

    const ranges = await prisma.iPRange.findMany()
    const matching = ranges.filter(range => ipInCidr(ip, range.network))
    if (!matching.length) return 'skipped'

    const preferred = (siteId && matching.find(r => r.siteId === siteId)) || matching[0]
    const existing = await prisma.iPAllocation.findUnique({
        where: { rangeId_ip: { rangeId: preferred.id, ip } },
    })

    const nextMac = mac ? mac.toLowerCase().replace(/[:-]/g, '') : null
    const nextHost = hostname?.trim() || null

    if (existing) {
        const data: Record<string, unknown> = {}
        if (nextHost && !existing.hostname) data.hostname = nextHost
        if (nextMac && !existing.mac) data.mac = nextMac
        if (Object.keys(data).length === 0) return 'unchanged'
        await prisma.iPAllocation.update({ where: { id: existing.id }, data })
        return 'updated'
    }

    await prisma.iPAllocation.create({
        data: {
            rangeId: preferred.id,
            ip,
            mac: nextMac,
            hostname: nextHost,
            type: 'STATIC',
        },
    })
    return 'created'
}
