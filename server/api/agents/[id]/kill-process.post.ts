import prisma from '../../../utils/prisma'
import { killProcess } from '../../../utils/agent-commands'

interface KillProcessBody {
    pid?: number
    name?: string
}

// POST /api/agents/[id]/kill-process - Terminate a process on the agent's machine
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const body = await readBody<KillProcessBody>(event)
    if (!body.pid) throw createError({ statusCode: 400, statusMessage: 'pid is required' })

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    if (agent.status !== 'ONLINE') throw createError({ statusCode: 409, statusMessage: 'Agent is not online' })

    let result: { success: boolean; error?: string }
    try {
        result = await killProcess(id, body.pid)
    } catch (err) {
        throw createError({ statusCode: 502, statusMessage: err instanceof Error ? err.message : 'Kill request failed' })
    }

    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'KILL_PROCESS',
            target: id,
            details: { pid: body.pid, name: body.name, result },
            result: result.success ? 'success' : 'failure',
        },
    })

    if (!result.success) {
        throw createError({ statusCode: 422, statusMessage: result.error || 'Failed to kill process' })
    }

    return { success: true }
})
