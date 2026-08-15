import prisma from '../../utils/prisma'

// PUT /api/agents/[id] - Update operator-set fields (currently just alias)
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const body = await readBody<{ alias?: string | null }>(event)
    const alias = body.alias?.trim() || null

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })

    await prisma.agent.update({ where: { id }, data: { alias } })

    if (agent.deviceId) {
        await prisma.device.update({
            where: { id: agent.deviceId },
            data: { name: alias || agent.hostname },
        }).catch(() => { /* device may have been deleted independently */ })
    }

    return { success: true, alias }
})
