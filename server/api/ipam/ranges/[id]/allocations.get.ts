import prisma from '../../../../utils/prisma'

// GET /api/ipam/ranges/[id]/allocations - Get allocations for a range
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Range ID is required',
        })
    }

    // Check range exists
    const range = await prisma.iPRange.findUnique({
        where: { id },
        include: {
            site: { select: { id: true, name: true } }
        }
    })

    if (!range) {
        throw createError({
            statusCode: 404,
            statusMessage: 'IP range not found',
        })
    }

    const allocations = await prisma.iPAllocation.findMany({
        where: { rangeId: id },
        orderBy: { ip: 'asc' }
    })

    // Get all devices with IPs to check which IPs are allocated to devices
    const devicesWithIps = await prisma.device.findMany({
        where: { ip: { not: null } },
        select: { id: true, name: true, ip: true, mac: true }
    })
    const deviceByIp = new Map(devicesWithIps.map(d => [d.ip!, d]))

    // Parse network to get IP list
    const [networkBase, cidr] = range.network.split('/')
    const prefix = parseInt(cidr) || 24
    const octets = networkBase.split('.').map(Number)
    const networkInt = (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3]
    const hostBits = 32 - prefix
    const totalHosts = Math.pow(2, hostBits)

    // Build IP grid (skip network and broadcast addresses)
    const ipGrid = []
    const allocationMap = new Map(allocations.map(a => [a.ip, a]))

    for (let i = 1; i < totalHosts - 1; i++) { // Skip .0 and .255
        const ipInt = networkInt + i
        const ip = [
            (ipInt >>> 24) & 255,
            (ipInt >>> 16) & 255,
            (ipInt >>> 8) & 255,
            ipInt & 255
        ].join('.')

        const allocation = allocationMap.get(ip)
        const device = deviceByIp.get(ip)

        ipGrid.push({
            ip,
            isGateway: ip === range.gateway,
            allocation: allocation ? {
                id: allocation.id,
                mac: allocation.mac,
                hostname: allocation.hostname,
                type: allocation.type,
            } : null,
            // Add device info if this IP is assigned to a device
            device: device ? {
                id: device.id,
                name: device.name,
                mac: device.mac,
            } : null
        })
    }

    // Count IPs that have devices
    const deviceCount = ipGrid.filter(ip => ip.device).length

    return {
        range: {
            id: range.id,
            name: range.name,
            network: range.network,
            gateway: range.gateway,
            vlan: range.vlan,
            description: range.description,
            site: range.site,
        },
        allocations,
        ipGrid,
        stats: {
            total: totalHosts - 2,
            used: allocations.length,
            free: totalHosts - 2 - allocations.length,
            devices: deviceCount,
        }
    }
})
