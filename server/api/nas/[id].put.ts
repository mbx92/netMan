import prisma from '../../utils/prisma'

interface UpdateNASBody {
    name?: string
    type?: string
    location?: string
    ipAddress?: string
    totalCapacityGB?: number
    usedCapacityGB?: number
    bayCount?: number
    notes?: string
    siteId?: string
    isActive?: boolean
}

// PUT /api/nas/:id - Update NAS device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<UpdateNASBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'NAS ID is required',
        })
    }

    // Check if device exists
    const existing = await prisma.nAS.findUnique({
        where: { id },
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'NAS device not found',
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

    const device = await prisma.nAS.update({
        where: { id },
        data: {
            name: body.name,
            type: body.type,
            location: body.location,
            ipAddress: body.ipAddress,
            totalCapacityGB: body.totalCapacityGB,
            usedCapacityGB: body.usedCapacityGB,
            bayCount: body.bayCount,
            notes: body.notes,
            siteId: body.siteId,
            isActive: body.isActive,
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
            action: 'UPDATE_NAS',
            target: id,
            details: {
                name: device.name,
            },
            result: 'success',
        },
    })

    return device
})
