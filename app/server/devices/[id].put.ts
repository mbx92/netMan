import prisma from '~/server/utils/prisma'
import type { DeviceType, DeviceStatus } from '~/generated/prisma'

interface UpdateDeviceBody {
    name?: string
    type?: DeviceType
    ip?: string
    mac?: string
    hostname?: string
    location?: string
    status?: DeviceStatus
    owner?: string
    notes?: string
    wakeable?: boolean
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

    const device = await prisma.device.update({
        where: { id },
        data: {
            ...body,
            mac: body.mac?.toLowerCase().replace(/[:-]/g, ''),
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
