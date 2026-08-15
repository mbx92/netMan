import prisma from '../../utils/prisma'
import { agentManager } from '../../utils/agent-manager'

// GET /api/agents/[id]
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const agent = await prisma.agent.findUnique({
        where: { id },
        include: { device: true },
    })
    if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })

    const { enrollTokenHash, authKeyHash, ...safeAgent } = agent
    return { ...safeAgent, isConnected: agentManager.isOnline(agent.id) }
})
