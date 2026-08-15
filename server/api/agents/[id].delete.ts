import prisma from '../../utils/prisma'

// DELETE /api/agents/[id] - Remove an agent (linked Device is kept, just unlinked)
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const existing = await prisma.agent.findUnique({ where: { id } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })

    await prisma.agent.delete({ where: { id } })

    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'DELETE_AGENT',
            target: id,
            details: { hostname: existing.hostname, platform: existing.platform },
            result: 'success',
        },
    })

    return { success: true, message: 'Agent deleted successfully' }
})
