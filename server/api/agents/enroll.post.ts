/**
 * Agent self-enrollment. Called once by a freshly-installed agent binary
 * with the one-time token from its install script. Unauthenticated by
 * design (the token itself is the credential) — rate-limited and logged.
 */
import prisma from '../../utils/prisma'
import { generateSecret, hashSecret, verifySecret } from '../../utils/agent-auth'
import { parseEnrollmentToken } from '../../utils/agent-install'
import { isRateLimited } from '../../utils/rate-limit'

interface EnrollBody {
    token?: string
    hostname?: string
    osVersion?: string
    agentVersion?: string
}

export default defineEventHandler(async (event) => {
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

    if (isRateLimited(`agent-enroll:${ip}`, 10, 5 * 60 * 1000)) {
        throw createError({ statusCode: 429, statusMessage: 'Too many enrollment attempts, try again later' })
    }

    const body = await readBody<EnrollBody>(event)
    const parsed = body.token ? parseEnrollmentToken(body.token) : null

    if (!parsed || !body.hostname) {
        await logFailure(ip, 'malformed request')
        throw createError({ statusCode: 400, statusMessage: 'token and hostname are required' })
    }

    const agent = await prisma.agent.findUnique({ where: { id: parsed.agentId } })
    if (!agent || agent.status !== 'PENDING') {
        await logFailure(ip, 'unknown or already-enrolled agent', parsed.agentId)
        throw createError({ statusCode: 401, statusMessage: 'Invalid or already-used enrollment token' })
    }

    if (!agent.enrollExpiresAt || agent.enrollExpiresAt < new Date()) {
        await logFailure(ip, 'expired token', agent.id)
        throw createError({ statusCode: 410, statusMessage: 'Enrollment token expired — generate a new install command' })
    }

    const valid = await verifySecret(parsed.secret, agent.enrollTokenHash)
    if (!valid) {
        await logFailure(ip, 'token mismatch', agent.id)
        throw createError({ statusCode: 401, statusMessage: 'Invalid enrollment token' })
    }

    const authKey = generateSecret()
    const authKeyHash = await hashSecret(authKey)

    await prisma.agent.update({
        where: { id: agent.id },
        data: {
            hostname: body.hostname,
            osVersion: body.osVersion,
            agentVersion: body.agentVersion,
            authKeyHash,
            enrolledAt: new Date(),
            enrollTokenHash: null,
            enrollExpiresAt: null,
            lastIp: ip,
        },
    })

    if (agent.deviceId) {
        await prisma.device.update({
            where: { id: agent.deviceId },
            data: { name: body.hostname, hostname: body.hostname },
        }).catch(() => { /* device may have been deleted independently; enrollment still succeeds */ })
    }

    await prisma.auditLog.create({
        data: {
            actor: `agent-enroll:${ip}`,
            action: 'ENROLL_AGENT',
            target: agent.id,
            details: { hostname: body.hostname, platform: agent.platform },
            result: 'success',
        },
    })

    // authKey is returned exactly once — the server only ever stores/verifies its hash from here on.
    return { agentId: agent.id, authKey }
})

async function logFailure(ip: string, reason: string, target?: string) {
    await prisma.auditLog.create({
        data: {
            actor: `agent-enroll:${ip}`,
            action: 'ENROLL_AGENT',
            target: target || 'unknown',
            details: { reason },
            result: 'failure',
        },
    }).catch(() => { /* best-effort audit log */ })
}
