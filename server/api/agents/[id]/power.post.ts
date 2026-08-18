import prisma from '../../../utils/prisma'
import { sendPowerAction, type PowerAction } from '../../../utils/agent-commands'

interface PowerActionBody {
    action?: PowerAction
}

const VALID_ACTIONS: PowerAction[] = ['restart', 'shutdown']

// POST /api/agents/[id]/power - Restart or shut down the machine the agent runs on
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const body = await readBody<PowerActionBody>(event)
    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
        throw createError({ statusCode: 400, statusMessage: `action must be one of: ${VALID_ACTIONS.join(', ')}` })
    }

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    if (agent.status !== 'ONLINE') throw createError({ statusCode: 409, statusMessage: 'Agent is not online' })

    let result: { success: boolean; error?: string }
    try {
        result = await sendPowerAction(id, body.action)
    } catch (err) {
        throw createError({ statusCode: 502, statusMessage: err instanceof Error ? err.message : 'Power action request failed' })
    }

    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'AGENT_POWER_ACTION',
            target: id,
            details: { action: body.action, result },
            result: result.success ? 'success' : 'failure',
        },
    })

    if (!result.success) {
        throw createError({ statusCode: 422, statusMessage: result.error || 'Power action failed' })
    }

    return { success: true }
})
