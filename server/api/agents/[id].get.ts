import prisma from '../../utils/prisma'
import { agentManager } from '../../utils/agent-manager'
import { serializeAgentBigints } from '../../utils/serialize-agent'
import { attachPrinterDeviceIds } from '../../utils/attach-printer-devices'

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
    return {
        ...serializeAgentBigints(safeAgent),
        printerInfo: await attachPrinterDeviceIds(safeAgent.printerInfo),
        isConnected: agentManager.isOnline(agent.id),
    }
})
