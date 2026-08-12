import prisma from '../../utils/prisma'

interface UpdateNASBody {
    name?: string
    type?: string
    model?: string | null
    location?: string
    ipAddress?: string
    totalCapacityGB?: number
    usedCapacityGB?: number
    bayCount?: number
    notes?: string
    siteId?: string
    isActive?: boolean
    username?: string
    password?: string
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
            model: body.model,
            location: body.location,
            ipAddress: body.ipAddress,
            totalCapacityGB: body.totalCapacityGB,
            usedCapacityGB: body.usedCapacityGB,
            ...(body.bayCount !== undefined
                ? { bayCount: Number(body.bayCount) > 0 ? Number(body.bayCount) : null }
                : {}),
            notes: body.notes,
            siteId: body.siteId,
            isActive: body.isActive,
            username: body.username,
            ...(body.password !== undefined ? { password: body.password } : {}),
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

    // Strip password from response
    const { password, ...deviceSafe } = device
    return deviceSafe
})
