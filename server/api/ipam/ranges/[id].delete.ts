import prisma from '../../../utils/prisma'

// DELETE /api/ipam/ranges/[id] - Delete IP range
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Range ID is required',
        })
    }

    // Check range exists
    const existing = await prisma.iPRange.findUnique({
        where: { id },
        include: {
            _count: { select: { allocations: true } }
        }
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'IP range not found',
        })
    }

    // Delete range (allocations will be cascade deleted due to schema relation)
    await prisma.iPRange.delete({
        where: { id }
    })

    return {
        success: true,
        message: `IP range ${existing.name} deleted successfully (${existing._count.allocations} allocations removed)`,
    }
})
