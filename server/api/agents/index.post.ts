import prisma from '../../utils/prisma'
import { issueEnrollmentToken, buildInstallCommands } from '../../utils/agent-install'

type Platform = 'WINDOWS' | 'LINUX' | 'MACOS'

const TYPE_CODE_BY_PLATFORM: Record<Platform, string> = {
    WINDOWS: 'PC_WINDOWS',
    LINUX: 'SERVER_LINUX',
    MACOS: 'PC_MACOS',
}

const PLATFORM_LABEL: Record<Platform, string> = {
    WINDOWS: 'Windows',
    LINUX: 'Linux',
    MACOS: 'macOS',
}

// POST /api/agents - Register a new pending agent and issue its one-time enrollment token
export default defineEventHandler(async (event) => {
    const body = await readBody<{ platform?: string; name?: string; siteId?: string }>(event)

    if (body.platform !== 'WINDOWS' && body.platform !== 'LINUX' && body.platform !== 'MACOS') {
        throw createError({ statusCode: 400, statusMessage: 'platform must be WINDOWS, LINUX, or MACOS' })
    }

    const name = body.name?.trim() || `Pending ${PLATFORM_LABEL[body.platform]} Agent`

    const device = await prisma.device.create({
        data: {
            name,
            typeCode: TYPE_CODE_BY_PLATFORM[body.platform],
            status: 'UNKNOWN',
            isManaged: true,
            siteId: body.siteId || undefined,
        },
    })

    const agent = await prisma.agent.create({
        data: {
            platform: body.platform,
            hostname: name,
            deviceId: device.id,
        },
    })

    const { token, tokenHash, expiresAt } = await issueEnrollmentToken(agent.id)
    await prisma.agent.update({
        where: { id: agent.id },
        data: { enrollTokenHash: tokenHash, enrollExpiresAt: expiresAt },
    })

    const config = useRuntimeConfig(event)
    const install = buildInstallCommands(config.public.appUrl as string, token)

    await prisma.auditLog.create({
        data: {
            actor: 'system', // TODO: Replace with actual user
            action: 'CREATE_AGENT',
            target: agent.id,
            details: { platform: body.platform, deviceId: device.id },
            result: 'success',
        },
    })

    return { agent, device, install, tokenExpiresAt: expiresAt }
})
