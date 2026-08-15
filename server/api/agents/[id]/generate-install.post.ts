import prisma from '../../../utils/prisma'
import { issueEnrollmentToken, buildInstallCommands } from '../../../utils/agent-install'

// POST /api/agents/[id]/generate-install - Re-issue a fresh one-time enrollment token
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })

    const { token, tokenHash, expiresAt } = await issueEnrollmentToken(agent.id)
    await prisma.agent.update({
        where: { id },
        data: { enrollTokenHash: tokenHash, enrollExpiresAt: expiresAt, status: 'PENDING' },
    })

    const config = useRuntimeConfig(event)
    const install = buildInstallCommands(config.public.appUrl as string, token)

    return { install, tokenExpiresAt: expiresAt }
})
