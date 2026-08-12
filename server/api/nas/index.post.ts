import prisma from '../../utils/prisma'

interface CreateNASBody {
    name: string
    type?: string
    model?: string
    location?: string
    ipAddress?: string
    totalCapacityGB?: number
    usedCapacityGB?: number
    bayCount?: number
    notes?: string
    siteId?: string
    username?: string
    password?: string
}

// POST /api/nas - Create a new NAS device
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateNASBody>(event)

    // Validate required fields
    if (!body.name) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name is required',
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

    const device = await prisma.nAS.create({
        data: {
            name: body.name,
            type: body.type,
            model: body.model || null,
            location: body.location,
            ipAddress: body.ipAddress,
            totalCapacityGB: body.totalCapacityGB,
            usedCapacityGB: body.usedCapacityGB,
            bayCount: body.bayCount != null && Number(body.bayCount) > 0 ? Number(body.bayCount) : null,
            notes: body.notes,
            siteId: body.siteId,
            username: body.username,
            password: body.password,
        },
        include: {
            site: {
                select: { id: true, name: true },
            },
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_NAS',
            target: device.id,
            details: {
                name: device.name,
                type: device.type,
            },
            result: 'success',
        },
    })

    return {
        id: device.id,
        name: device.name,
        type: device.type,
        model: device.model,
        location: device.location,
        ipAddress: device.ipAddress,
        totalCapacityGB: device.totalCapacityGB,
        usedCapacityGB: device.usedCapacityGB,
        bayCount: device.bayCount,
        notes: device.notes,
        siteId: device.siteId,
        site: device.site,
        isActive: device.isActive,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        hasCredentials: !!(device.username && device.password),
    }
})
