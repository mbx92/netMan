import prisma from '../../utils/prisma'

interface TopologyNode {
    id: string
    name: string
    type: 'router' | 'switch' | 'access_point' | 'server' | 'pc' | 'nas' | 'printer' | 'camera' | 'smart_tv' | 'vm' | 'unknown'
    typeCode: string  // Original device type code from DB
    ip?: string
    mac?: string
    siteId?: string
    siteName?: string
    status?: 'online' | 'offline' | 'unknown'
    ports?: number
    tier?: number // 0 = top (router), 1 = switch, 2 = devices
}

interface TopologyLink {
    source: string
    target: string
    label?: string
    linkType: 'physical' | 'virtual' | 'uplink'  // physical = port connection, virtual = VM-host, uplink = inferred
}

// GET /api/topology - Get network topology data
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = query.siteId as string | undefined
    const floor = query.floor as string | undefined
    const location = query.location as string | undefined

    const nodes: TopologyNode[] = []
    const links: TopologyLink[] = []

    try {
        // Routers now come from Device table with type ROUTER (no longer from MikrotikDevice)

        // Build where clause with filters
        const deviceWhere: { siteId?: string; floor?: string; location?: { contains: string; mode: 'insensitive' } } = {}
        if (siteId) deviceWhere.siteId = siteId
        if (floor) deviceWhere.floor = floor
        if (location) deviceWhere.location = { contains: location, mode: 'insensitive' }

        const devices = await prisma.device.findMany({
            where: deviceWhere,
            include: {
                site: { select: { id: true, name: true } },
                ports: {
                    include: {
                        connectedDevice: { select: { id: true, name: true } }
                    }
                },
                parentDevice: { select: { id: true, name: true } }  // For VM-host relationship
            }
        })

        // Add devices as nodes
        for (const device of devices) {
            const nodeId = `device-${device.id}`

            // Map device type to topology node type
            let nodeType: TopologyNode['type'] = 'unknown'
            let tier = 2 // default tier for end devices

            if (device.typeCode.includes('ROUTER')) {
                nodeType = 'router'
                tier = 0
            } else if (device.typeCode.includes('SWITCH')) {
                nodeType = 'switch'
                tier = 1
            } else if (device.typeCode.includes('ACCESS_POINT')) {
                nodeType = 'access_point'
                tier = 1
            } else if (device.typeCode.includes('SERVER')) {
                nodeType = 'server'
            } else if (device.typeCode.includes('NAS')) {
                nodeType = 'nas'
            } else if (device.typeCode.includes('PRINTER')) {
                nodeType = 'printer'
            } else if (device.typeCode.includes('CAMERA')) {
                nodeType = 'camera'
            } else if (device.typeCode.includes('SMART_TV') || device.typeCode.includes('TV')) {
                nodeType = 'smart_tv'
            } else if (device.typeCode.includes('VM') || device.typeCode.includes('VIRTUAL')) {
                nodeType = 'vm'
            } else if (device.typeCode.includes('PC') || device.typeCode.includes('LAPTOP')) {
                nodeType = 'pc'
            }

            nodes.push({
                id: nodeId,
                name: device.name,
                type: nodeType,
                typeCode: device.typeCode,  // Include original typeCode for color lookup
                ip: device.ip || undefined,
                mac: device.mac || undefined,
                siteId: device.siteId || undefined,
                siteName: device.site?.name,
                status: device.status.toLowerCase() as 'online' | 'offline' | 'unknown',
                ports: device.ports.length || device.portCount || 0,
                tier,
            })

            // Add links from port connections
            for (const port of device.ports) {
                if (port.connectedDeviceId) {
                    const targetId = `device-${port.connectedDeviceId}`
                    links.push({
                        source: nodeId,
                        target: targetId,
                        label: port.portName,
                        linkType: 'physical',
                    })
                }
            }

            // Add link from child device to parent device (e.g., VM to hypervisor)
            if (device.parentDeviceId) {
                const parentId = `device-${device.parentDeviceId}`
                links.push({
                    source: parentId,
                    target: nodeId,
                    label: 'VM',
                    linkType: 'virtual',
                })
            }

            // Connect switches/APs to first router in same site
            if (tier === 1 && device.siteId) {
                const siteRouter = nodes.find(n => n.type === 'router' && n.siteId === device.siteId)
                if (siteRouter) {
                    links.push({
                        source: siteRouter.id,
                        target: nodeId,
                        label: 'uplink',
                        linkType: 'uplink',
                    })
                }
            }
        }

        // Get site list for filtering
        const sites = await prisma.site.findMany({
            select: { id: true, name: true }
        })

        // Get unique floors for filtering
        const floorsData = await prisma.device.findMany({
            where: { floor: { not: null } },
            select: { floor: true },
            distinct: ['floor']
        })
        const floors = floorsData.map(d => d.floor).filter(Boolean) as string[]

        // Get device types for legend (active only, sorted)
        const deviceTypes = await prisma.deviceType.findMany({
            where: { isActive: true },
            select: {
                code: true,
                name: true,
                color: true,
                icon: true,
                topologyTier: true,
            },
            orderBy: [
                { topologyTier: 'asc' },
                { sortOrder: 'asc' },
                { name: 'asc' },
            ]
        })

        return {
            nodes,
            links,
            stats: {
                totalNodes: nodes.length,
                routers: nodes.filter(n => n.type === 'router').length,
                switches: nodes.filter(n => n.type === 'switch').length,
                devices: nodes.filter(n => !['router', 'switch'].includes(n.type)).length,
                online: nodes.filter(n => n.status === 'online').length,
                offline: nodes.filter(n => n.status === 'offline').length,
            },
            sites,
            floors,
            deviceTypes,
        }
    } catch (error) {
        console.error('[Topology] Error:', error)

        // Return empty data on error
        return {
            nodes: [],
            links: [],
            stats: {
                totalNodes: 0,
                routers: 0,
                switches: 0,
                devices: 0,
                online: 0,
                offline: 0,
            },
            sites: [],
            floors: [],
            deviceTypes: [],
        }
    }
})
