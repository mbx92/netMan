import prisma from '../../utils/prisma'

interface CreateDeviceBody {
    name: string
    typeCode: string  // Changed from type enum to typeCode string
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
}

// POST /api/devices - Create a new device
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateDeviceBody>(event)

    // Validate required fields
    if (!body.name || !body.typeCode) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name and type are required',
        })
    }

    // Validate type code exists
    const deviceType = await prisma.deviceType.findUnique({
        where: { code: body.typeCode }
    })
    if (!deviceType) {
        throw createError({
            statusCode: 400,
            statusMessage: `Invalid device type: ${body.typeCode}`,
        })
    }

    // Check for duplicate MAC if provided
    if (body.mac) {
        const existing = await prisma.device.findUnique({
            where: { mac: body.mac.toLowerCase().replace(/[:-]/g, '') }
        })
        if (existing) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Device with this MAC address already exists',
            })
        }
    }

    const device = await prisma.device.create({
        data: {
            name: body.name,
            typeCode: body.typeCode,
            ip: body.ip,
            mac: body.mac?.toLowerCase().replace(/[:-]/g, ''),
            hostname: body.hostname,
            floor: body.floor,
            location: body.location,
            siteId: body.siteId || null,
            status: (body.status as 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'MAINTENANCE') || 'UNKNOWN',
            owner: body.owner,
            notes: body.notes,
            wakeable: body.wakeable || false,
            isManaged: body.isManaged ?? true,
        },
        include: {
            deviceType: true,
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'CREATE_DEVICE',
            target: device.id,
            details: { name: device.name, typeCode: device.typeCode },
            result: 'success',
        },
    })

    return device
})
