import prisma from '../../utils/prisma'
import { createMikroTikClient } from '../../utils/mikrotik'

interface CreateMikrotikBody {
    name: string
    host: string
    port?: number
    username: string
    password: string
    apiVersion: 'v6' | 'v7'
    siteId?: string
    testConnection?: boolean
}

// POST /api/mikrotik - Create a new MikroTik device
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateMikrotikBody>(event)

    // Validate required fields
    if (!body.name || !body.host || !body.username || !body.password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name, host, username, and password are required',
        })
    }

    // Validate API version
    if (!['v6', 'v7'].includes(body.apiVersion)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'API version must be "v6" or "v7"',
        })
    }

    // Set default port based on API version
    const port = body.port || (body.apiVersion === 'v7' ? 443 : 8728)

    // Check for duplicate host:port
    const existing = await prisma.mikrotikDevice.findUnique({
        where: { host_port: { host: body.host, port } },
    })

    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'MikroTik device with this host and port already exists',
        })
    }

    // Validate site if provided
    if (body.siteId) {
        const site = await prisma.site.findUnique({
            where: { id: body.siteId },
        })
        if (!site) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Site not found',
            })
        }
    }

    // Test connection if requested
    if (body.testConnection) {
        try {
            const client = createMikroTikClient({
                host: body.host,
                port,
                username: body.username,
                password: body.password,
                apiVersion: body.apiVersion,
            })
            const connected = await client.testConnection()
            if (!connected) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Failed to connect to MikroTik device. Please check credentials and network.',
                })
            }
        } catch (error) {
            throw createError({
                statusCode: 400,
                statusMessage: `Connection test failed: ${(error as Error).message}`,
            })
        }
    }

    const device = await prisma.mikrotikDevice.create({
        data: {
            name: body.name,
            host: body.host,
            port,
            username: body.username,
            password: body.password,
            apiVersion: body.apiVersion,
            siteId: body.siteId,
        },
        include: {
            site: {
                select: { id: true, name: true },
            },
        },
    })

    // Fetch router info from MikroTik API to auto-fill Device data
    let routerInfo: {
        identity?: string
        mac?: string
        model?: string
        version?: string
        portCount: number
        bridges: { name: string; mac?: string }[]
        vlans: { name: string; vlanId: number; interface?: string }[]
    } = { portCount: 0, bridges: [], vlans: [] }

    try {
        const client = createMikroTikClient({
            host: body.host,
            port,
            username: body.username,
            password: body.password,
            apiVersion: body.apiVersion,
        })
        routerInfo = await client.getRouterInfo()
        console.log(`[MikroTik] Fetched router info: identity=${routerInfo.identity}, mac=${routerInfo.mac}, ports=${routerInfo.portCount}`)
    } catch (error) {
        console.error('[MikroTik] Failed to fetch router info:', error)
    }

    // Build notes with bridges and VLANs info
    let notes = ''
    if (routerInfo.model) {
        notes += `Model: ${routerInfo.model}\n`
    }
    if (routerInfo.version) {
        notes += `RouterOS: ${routerInfo.version}\n`
    }
    if (routerInfo.bridges.length > 0) {
        notes += `Bridges: ${routerInfo.bridges.map(b => b.name).join(', ')}\n`
    }
    if (routerInfo.vlans.length > 0) {
        notes += `VLANs: ${routerInfo.vlans.map(v => `${v.name}(${v.vlanId})`).join(', ')}\n`
    }

    // Create Device record with router info auto-filled
    const routerDevice = await prisma.device.create({
        data: {
            name: routerInfo.identity || body.name,
            typeCode: 'ROUTER',
            ip: body.host,
            mac: routerInfo.mac || null,
            hostname: routerInfo.identity || null,
            portCount: routerInfo.portCount || null,
            siteId: body.siteId || null,
            status: 'UNKNOWN',
            isManaged: true,
            notes: notes || null,
            // Store MikroTik API credentials in Device table too
            apiPort: port,
            apiUser: body.username,
            apiPass: body.password,
            apiVersion: body.apiVersion,
            isApiActive: true,
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_MIKROTIK',
            target: device.id,
            details: {
                name: device.name,
                host: device.host,
                apiVersion: device.apiVersion,
                deviceId: routerDevice.id,
            },
            result: 'success',
        },
    })

    // Return without password
    return {
        id: device.id,
        name: device.name,
        host: device.host,
        port: device.port,
        username: device.username,
        apiVersion: device.apiVersion,
        isActive: device.isActive,
        siteId: device.siteId,
        site: device.site,
        createdAt: device.createdAt,
    }
})
