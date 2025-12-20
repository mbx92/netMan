import prisma from '../../utils/prisma'

// DELETE /api/sites/[id] - Delete a site
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Site ID is required',
        })
    }

    // Check if site exists
    const existing = await prisma.site.findUnique({
        where: { id },
        include: {
            _count: {
                select: { devices: true, mikrotikDevices: true },
            },
        },
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Site not found',
        })
    }

    // Warn if site has associated devices
    if (existing._count.devices > 0 || existing._count.mikrotikDevices > 0) {
        throw createError({
            statusCode: 400,
            statusMessage: `Cannot delete site with ${existing._count.devices} devices and ${existing._count.mikrotikDevices} MikroTik routers. Please reassign or delete them first.`,
        })
    }

    await prisma.site.delete({
        where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_SITE',
            target: id,
            details: { name: existing.name },
            result: 'success',
        },
    })

    return { success: true }
})
