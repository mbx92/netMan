import prisma from '../../../utils/prisma'
import { clearClientCache, createMikroTikClient } from '../../../utils/mikrotik'

interface UpdateMikrotikBody {
    name?: string
    host?: string
    port?: number
    username?: string
    password?: string
    apiVersion?: 'v6' | 'v7'
    siteId?: string | null
    testConnection?: boolean
}

// PUT /api/mikrotik/[id] - Update a MikroTik device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID is required',
        })
    }

    const body = await readBody<UpdateMikrotikBody>(event)

    const existing = await prisma.mikrotikDevice.findUnique({
        where: { id },
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'MikroTik device not found',
        })
    }

    // Validate API version if provided
    if (body.apiVersion && !['v6', 'v7'].includes(body.apiVersion)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'API version must be "v6" or "v7"',
        })
    }

    // Resolve port: explicit, or derive from version
    const apiVersion = body.apiVersion || existing.apiVersion
    const port = body.port !== undefined
        ? body.port
        : (body.host ? (body.port || (apiVersion === 'v7' ? 443 : 8728)) : existing.port)
    const host = body.host || existing.host

    // Check for duplicate host:port if changed
    if (body.host || body.port !== undefined) {
        const duplicate = await prisma.mikrotikDevice.findUnique({
            where: { host_port: { host, port } },
        })
        if (duplicate && duplicate.id !== id) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Another MikroTik device with this host and port already exists',
            })
        }
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

    // Test connection if new credentials provided and testing requested
    if (body.testConnection && (body.host || body.username || body.password)) {
        try {
            const client = createMikroTikClient({
                host,
                port,
                username: body.username || existing.username,
                password: body.password || existing.password,
                apiVersion,
            })
            const connected = await client.testConnection()
            if (!connected) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Failed to connect to MikroTik device. Please check credentials and network.',
                })
            }
        } catch (error) {
            if ((error as { statusCode?: number }).statusCode) throw error
            throw createError({
                statusCode: 400,
                statusMessage: `Connection test failed: ${(error as Error).message}`,
            })
        }
    }

    const device = await prisma.mikrotikDevice.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.host !== undefined && { host: body.host }),
            port,
            ...(body.username !== undefined && { username: body.username }),
            ...(body.password !== undefined && { password: body.password }),
            ...(body.apiVersion !== undefined && { apiVersion: body.apiVersion }),
            siteId: body.siteId !== undefined ? (body.siteId || null) : undefined,
        },
        include: {
            site: {
                select: { id: true, name: true },
            },
        },
    })

    // Clear client cache for this device
    clearClientCache(id)

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'UPDATE_MIKROTIK',
            target: id,
            details: { name: device.name, host: device.host },
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
        lastSync: device.lastSync,
        siteId: device.siteId,
        site: device.site,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
    }
})
