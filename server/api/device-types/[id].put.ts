import prisma from '../../utils/prisma'

interface UpdateDeviceTypeBody {
    name?: string
    icon?: string
    color?: string
    isNetworkDevice?: boolean
    canHavePorts?: boolean
    topologyTier?: number
    sortOrder?: number
    isActive?: boolean
}

// PUT /api/device-types/[id] - Update a device type
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<UpdateDeviceTypeBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device type ID is required',
        })
    }

    // Check if device type exists
    const existing = await prisma.deviceType.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device type not found',
        })
    }

    const deviceType = await prisma.deviceType.update({
        where: { id },
        data: body,
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'UPDATE_DEVICE_TYPE',
            target: deviceType.id,
            details: { changes: body },
            result: 'success',
        },
    })

    return deviceType
})
