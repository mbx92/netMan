import prisma from '../../utils/prisma'

interface CreateDeviceTypeBody {
    code: string
    name: string
    icon?: string
    color?: string
    isNetworkDevice?: boolean
    canHavePorts?: boolean
    topologyTier?: number
    sortOrder?: number
}

// POST /api/device-types - Create a new device type
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateDeviceTypeBody>(event)

    // Validate required fields
    if (!body.code || !body.name) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Code and name are required',
        })
    }

    // Check for duplicate code
    const existing = await prisma.deviceType.findUnique({
        where: { code: body.code }
    })
    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'Device type with this code already exists',
        })
    }

    const deviceType = await prisma.deviceType.create({
        data: {
            code: body.code.toUpperCase().replace(/\s+/g, '_'),
            name: body.name,
            icon: body.icon,
            color: body.color,
            isNetworkDevice: body.isNetworkDevice ?? false,
            canHavePorts: body.canHavePorts ?? false,
            topologyTier: body.topologyTier ?? 2,
            sortOrder: body.sortOrder ?? 50,
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_DEVICE_TYPE',
            target: deviceType.id,
            details: { code: deviceType.code, name: deviceType.name },
            result: 'success',
        },
    })

    return deviceType
})
