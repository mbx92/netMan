import prisma from '../../utils/prisma'
import { HikvisionClient } from '../../utils/hikvision'

interface CreateHikvisionBody {
    name: string
    host: string
    port?: number
    username: string
    password: string
    protocol?: 'http' | 'https'
    deviceType?: string
    siteId?: string
    testConnection?: boolean
}

// POST /api/hikvision - Create a new Hikvision device
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateHikvisionBody>(event)

    if (!body.name || !body.host || !body.username || !body.password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name, host, username, and password are required',
        })
    }

    const protocol = body.protocol || 'http'
    const port = body.port || (protocol === 'https' ? 443 : 80)

    const existing = await prisma.hikvisionDevice.findUnique({
        where: { host_port: { host: body.host, port } },
    })

    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'Hikvision device with this host and port already exists',
        })
    }

    if (body.siteId) {
        const site = await prisma.site.findUnique({ where: { id: body.siteId } })
        if (!site) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Site not found',
            })
        }
    }

    let deviceInfo = {
        deviceName: undefined as string | undefined,
        model: undefined as string | undefined,
        serialNumber: undefined as string | undefined,
        macAddress: undefined as string | undefined,
        firmwareVersion: undefined as string | undefined,
        deviceType: undefined as string | undefined,
    }

    if (body.testConnection) {
        const client = new HikvisionClient({
            host: body.host,
            port,
            username: body.username,
            password: body.password,
            protocol,
        })

        const connected = await client.testConnection()
        if (!connected) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Failed to connect to Hikvision device. Please check credentials and network.',
            })
        }

        try {
            deviceInfo = await client.getDeviceInfo()
        } catch (error) {
            console.error('[Hikvision] Failed to fetch device info during create:', error)
        }
    }

    const device = await prisma.hikvisionDevice.create({
        data: {
            name: body.name,
            host: body.host,
            port,
            username: body.username,
            password: body.password,
            protocol,
            deviceType: body.deviceType || deviceInfo.deviceType || 'NVR',
            model: deviceInfo.model || null,
            serialNumber: deviceInfo.serialNumber || null,
            macAddress: deviceInfo.macAddress || null,
            firmware: deviceInfo.firmwareVersion || null,
            siteId: body.siteId || null,
        },
        include: {
            site: {
                select: { id: true, name: true },
            },
        },
    })

    // Optionally create a Device record for the NVR/DVR itself
    try {
        await prisma.device.create({
            data: {
                name: deviceInfo.deviceName || body.name,
                typeCode: 'OTHER',
                ip: body.host,
                mac: deviceInfo.macAddress || null,
                hostname: deviceInfo.deviceName || null,
                siteId: body.siteId || null,
                status: 'UNKNOWN',
                isManaged: true,
                notes: `Hikvision ${deviceInfo.deviceType || body.deviceType || 'NVR'} - ${deviceInfo.model || 'unknown model'}`,
            },
        })
    } catch (error) {
        console.error('[Hikvision] Failed to create Device record:', error)
    }

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_HIKVISION',
            target: device.id,
            details: {
                name: device.name,
                host: device.host,
                model: device.model,
            },
            result: 'success',
        },
    })

    return {
        id: device.id,
        name: device.name,
        host: device.host,
        port: device.port,
        username: device.username,
        protocol: device.protocol,
        deviceType: device.deviceType,
        model: device.model,
        serialNumber: device.serialNumber,
        macAddress: device.macAddress,
        firmware: device.firmware,
        isActive: device.isActive,
        siteId: device.siteId,
        site: device.site,
        createdAt: device.createdAt,
    }
})
