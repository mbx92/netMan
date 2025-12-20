import prisma from '../../../utils/prisma'

// DELETE /api/ipam/allocations/[id] - Delete IP allocation
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Allocation ID is required',
        })
    }

    // Check allocation exists
    const existing = await prisma.iPAllocation.findUnique({
        where: { id }
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'IP allocation not found',
        })
    }

    await prisma.iPAllocation.delete({
        where: { id }
    })

    return {
        success: true,
        message: `IP ${existing.ip} deallocated successfully`,
    }
})
