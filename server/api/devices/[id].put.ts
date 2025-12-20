import prisma from '../../utils/prisma'

interface UpdateDeviceBody {
    name?: string
    typeCode?: string  // Changed from type enum to typeCode string
    ip?: string
    mac?: string
    hostname?: string
    floor?: string
    location?: string
    siteId?: string
    status?: string
    owner?: string
    notes?: string
    wakeable?: boolean
    isManaged?: boolean
    parentDeviceId?: string | null  // For VM to host linking
}

// PUT /api/devices/[id] - Update a device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<UpdateDeviceBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    // Check if device exists
    const existing = await prisma.device.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device not found',
        })
    }

    // Check for duplicate MAC if updating
    if (body.mac && body.mac !== existing.mac) {
        const macDuplicate = await prisma.device.findUnique({
            where: { mac: body.mac.toLowerCase().replace(/[:-]/g, '') }
        })
        if (macDuplicate) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Device with this MAC address already exists',
            })
        }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.typeCode !== undefined) updateData.typeCode = body.typeCode
    if (body.ip !== undefined) updateData.ip = body.ip
    if (body.mac !== undefined) updateData.mac = body.mac?.toLowerCase().replace(/[:-]/g, '')
    if (body.hostname !== undefined) updateData.hostname = body.hostname
    if (body.floor !== undefined) updateData.floor = body.floor
    if (body.location !== undefined) updateData.location = body.location
    if (body.siteId !== undefined) updateData.siteId = body.siteId || null
    if (body.status !== undefined) updateData.status = body.status
    if (body.owner !== undefined) updateData.owner = body.owner
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.wakeable !== undefined) updateData.wakeable = body.wakeable
    if (body.isManaged !== undefined) updateData.isManaged = body.isManaged
    if (body.parentDeviceId !== undefined) updateData.parentDeviceId = body.parentDeviceId || null

    const device = await prisma.device.update({
        where: { id },
        data: updateData,
        include: {
            deviceType: true,
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'UPDATE_DEVICE',
            target: device.id,
            details: { changes: body },
            result: 'success',
        },
    })

    return device
})
