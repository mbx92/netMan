import prisma from '~/server/utils/prisma'
import type { DeviceType, DeviceStatus } from '~/generated/prisma'

interface CreateDeviceBody {
    name: string
    type: DeviceType
    ip?: string
    mac?: string
    hostname?: string
    location?: string
    status?: DeviceStatus
    owner?: string
    notes?: string
    wakeable?: boolean
}

// POST /api/devices - Create a new device
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateDeviceBody>(event)

    // Validate required fields
    if (!body.name || !body.type) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name and type are required',
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
            type: body.type,
            ip: body.ip,
            mac: body.mac?.toLowerCase().replace(/[:-]/g, ''),
            hostname: body.hostname,
            location: body.location,
            status: body.status || 'UNKNOWN',
            owner: body.owner,
            notes: body.notes,
            wakeable: body.wakeable || false,
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'CREATE_DEVICE',
            target: device.id,
            details: { name: device.name, type: device.type },
            result: 'success',
        },
    })

    return device
})
