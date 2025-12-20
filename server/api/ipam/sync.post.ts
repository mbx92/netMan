import prisma from '../../utils/prisma'
import { getAllMikroTikClients } from '../../utils/mikrotik'

// POST /api/ipam/sync - Sync allocations from MikroTik ARP table
// Mode: 'preview' = show what will change, 'apply' = actually apply changes
// NEVER removes existing allocations - only adds new or updates existing
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const rangeId = body.rangeId as string | undefined
    const siteId = body.siteId as string | undefined
    const mode = (body.mode as 'preview' | 'apply') || 'preview'

    // Get MikroTik clients (optionally filtered by site)
    const clients = await getAllMikroTikClients()
    const filteredClients = siteId
        ? clients.filter(c => c.config.siteId === siteId)
        : clients

    if (filteredClients.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'No MikroTik routers configured' + (siteId ? ' for this site' : ''),
        })
    }

    // Get IP ranges to match against
    const rangeWhere = rangeId ? { id: rangeId } : (siteId ? { siteId } : {})
    const ranges = await prisma.iPRange.findMany({ where: rangeWhere })

    if (ranges.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'No IP ranges found. Please create an IP range first.',
        })
    }

    // Helper to check if IP is in a range
    function isIpInRange(ip: string, network: string): boolean {
        const [networkBase, cidr] = network.split('/')
        const prefix = parseInt(cidr) || 24
        const networkOctets = networkBase.split('.').map(Number)
        const networkInt = (networkOctets[0] << 24) + (networkOctets[1] << 16) + (networkOctets[2] << 8) + networkOctets[3]
        const mask = ~((1 << (32 - prefix)) - 1)

        const ipOctets = ip.split('.').map(Number)
        const ipInt = (ipOctets[0] << 24) + (ipOctets[1] << 16) + (ipOctets[2] << 8) + ipOctets[3]

        return (ipInt & mask) === (networkInt & mask)
    }

    // Collect all ARP entries from all routers
    const arpMap = new Map<string, { mac: string; router: string }>()
    const errors: string[] = []

    for (const { config, client } of filteredClients) {
        try {
            const arpEntries = await client.getArpTable()
            console.log(`[IPAM Sync] ${config.name || config.host}: Found ${arpEntries.length} ARP entries`)

            for (const entry of arpEntries) {
                const ip = entry.address
                const mac = entry['mac-address']

                // Only process entries with BOTH IP and MAC (ignore incomplete ARP from ping)
                if (ip && mac) {
                    const normalizedMac = mac.toLowerCase().replace(/[:-]/g, '')
                    arpMap.set(ip, { mac: normalizedMac, router: config.name || config.host })
                }
            }
        } catch (error) {
            const err = error as Error
            console.log(`[IPAM Sync] ${config.name || config.host}: Error:`, err.message)
            errors.push(`${config.name || config.host}: ${err.message}`)
        }
    }

    console.log(`[IPAM Sync] Total ARP entries with MAC: ${arpMap.size}`)

    // Get all existing allocations for the ranges
    const rangeIds = ranges.map(r => r.id)
    const existingAllocations = await prisma.iPAllocation.findMany({
        where: { rangeId: { in: rangeIds } }
    })
    const allocationMap = new Map(existingAllocations.map(a => [`${a.rangeId}:${a.ip}`, a]))

    // Get all devices with IPs (to integrate with Devices module)
    const devicesWithIps = await prisma.device.findMany({
        where: { ip: { not: null } },
        select: { id: true, name: true, ip: true, mac: true }
    })
    const deviceByIp = new Map(devicesWithIps.map(d => [d.ip!, d]))

    // Prepare changes
    const changes: {
        type: 'add' | 'update'
        ip: string
        rangeName: string
        mac: string
        existingMac?: string
        deviceName?: string
    }[] = []

    // Process each ARP entry
    for (const [ip, { mac }] of arpMap) {
        // Find matching range
        const matchingRange = ranges.find(r => isIpInRange(ip, r.network))
        if (!matchingRange) continue

        const key = `${matchingRange.id}:${ip}`
        const existing = allocationMap.get(key)
        const device = deviceByIp.get(ip)

        if (existing) {
            // Check if MAC changed
            const existingMac = existing.mac?.toLowerCase().replace(/[:-]/g, '') || ''
            if (existingMac !== mac) {
                changes.push({
                    type: 'update',
                    ip,
                    rangeName: matchingRange.name,
                    mac,
                    existingMac,
                    deviceName: device?.name,
                })
            }
        } else {
            // New allocation
            changes.push({
                type: 'add',
                ip,
                rangeName: matchingRange.name,
                mac,
                deviceName: device?.name,
            })
        }
    }

    // If preview mode, just return the changes
    if (mode === 'preview') {
        const toAdd = changes.filter(c => c.type === 'add')
        const toUpdate = changes.filter(c => c.type === 'update')

        return {
            success: true,
            mode: 'preview',
            message: `Preview: ${toAdd.length} to add, ${toUpdate.length} to update`,
            stats: {
                routers: filteredClients.length,
                arpEntriesWithMac: arpMap.size,
                toAdd: toAdd.length,
                toUpdate: toUpdate.length,
            },
            changes: changes.slice(0, 50), // Limit to first 50 for display
            totalChanges: changes.length,
            errors: errors.length > 0 ? errors : undefined,
        }
    }

    // Apply mode - actually make the changes
    let addedAllocations = 0
    let updatedAllocations = 0

    for (const change of changes) {
        const matchingRange = ranges.find(r => r.name === change.rangeName)
        if (!matchingRange) continue

        if (change.type === 'add') {
            await prisma.iPAllocation.create({
                data: {
                    rangeId: matchingRange.id,
                    ip: change.ip,
                    mac: change.mac,
                    hostname: change.deviceName || null,
                    type: 'STATIC',
                }
            })
            addedAllocations++
        } else if (change.type === 'update') {
            const key = `${matchingRange.id}:${change.ip}`
            const existing = allocationMap.get(key)
            if (existing) {
                await prisma.iPAllocation.update({
                    where: { id: existing.id },
                    data: { mac: change.mac }
                })
                updatedAllocations++
            }
        }
    }

    return {
        success: true,
        mode: 'apply',
        message: `Applied: ${addedAllocations} added, ${updatedAllocations} updated`,
        stats: {
            routers: filteredClients.length,
            arpEntriesWithMac: arpMap.size,
            addedAllocations,
            updatedAllocations,
        },
        errors: errors.length > 0 ? errors : undefined,
    }
})
