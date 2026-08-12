import prisma from '../../utils/prisma'

interface UpdateHikvisionBody {
    name?: string
    host?: string
    port?: number
    username?: string
    password?: string
    protocol?: 'http' | 'https'
    deviceType?: string
    siteId?: string
    isActive?: boolean
}

// PUT /api/hikvision/[id] - Update a Hikvision device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<UpdateHikvisionBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Hikvision device ID is required',
        })
    }

    const existing = await prisma.hikvisionDevice.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Hikvision device not found',
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

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.host !== undefined) data.host = body.host
    if (body.port !== undefined) data.port = body.port
    if (body.username !== undefined) data.username = body.username
    if (body.password !== undefined) data.password = body.password
    if (body.protocol !== undefined) data.protocol = body.protocol
    if (body.deviceType !== undefined) data.deviceType = body.deviceType
    if (body.siteId !== undefined) data.siteId = body.siteId || null
    if (body.isActive !== undefined) data.isActive = body.isActive

    const device = await prisma.hikvisionDevice.update({
        where: { id },
        data,
        include: {
            site: {
                select: { id: true, name: true },
            },
        },
    })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'UPDATE_HIKVISION',
            target: device.id,
            details: { name: device.name, host: device.host },
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
        updatedAt: device.updatedAt,
    }
})
