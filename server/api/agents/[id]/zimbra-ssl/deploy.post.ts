import prisma from '../../../../utils/prisma'
import { deployZimbraSsl, type ZimbraSslDeployRequest } from '../../../../utils/agent-commands'
import { requireSession } from '../../../../utils/require-session'
import { isRateLimited } from '../../../../utils/rate-limit'
import { completeZimbraSslJob, createZimbraSslJob, failZimbraSslJob } from '../../../../utils/zimbra-ssl-jobs'

const MAX_PEM_LENGTH = 256 * 1024

function parseDomains(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw createError({ statusCode: 400, statusMessage: 'Provide between 1 and 20 certificate domains' })
  }
  const domains = [...new Set(value.map(item => String(item).trim().toLowerCase()).filter(Boolean))]
  const valid = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
  if (!domains.length || domains.some(domain => !valid.test(domain))) {
    throw createError({ statusCode: 400, statusMessage: 'One or more certificate domains are invalid' })
  }
  return domains
}

function requirePem(value: unknown, label: string, marker: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PEM_LENGTH || !value.includes(marker)) {
    throw createError({ statusCode: 400, statusMessage: `${label} is missing or invalid` })
  }
  return value
}

function supportsSslDeployment(version: string | null, minimumPatch = 0): boolean {
  if (!version) return false
  const parts = version.split('.').map(part => Number.parseInt(part, 10))
  if (parts.some(Number.isNaN)) return false
  const [major = 0, minor = 0, patch = 0] = parts
  return major > 0 || minor > 7 || (minor === 7 && patch >= minimumPatch)
}

function deploymentErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Agent is not connected') return 'agent_not_connected'
  if (message === 'An SSL deployment is already in progress for this agent') return 'ssl_deployment_in_progress'
  if (message === 'Agent did not respond in time') return 'agent_timeout'
  return 'ssl_deployment_command_failed'
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.roleName !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Administrator access required' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID required' })
  if (isRateLimited(`zimbra-ssl:${id}`, 1, 30_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Wait 30 seconds before starting another SSL deployment' })
  }

  const body = await readBody(event)
  const sslMode = body?.sslMode
  if (sslMode !== 'letsencrypt' && sslMode !== 'premium') {
    throw createError({ statusCode: 400, statusMessage: 'Choose Let’s Encrypt or Premium SSL' })
  }

  const agent = await prisma.agent.findUnique({ where: { id }, select: { platform: true, hostname: true, agentVersion: true, lastMetrics: true } })
  if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  if (agent.platform !== 'LINUX') throw createError({ statusCode: 400, statusMessage: 'Zimbra SSL deployment requires a Linux agent' })
  const minimumPatch = sslMode === 'letsencrypt' ? 1 : 0
  if (!supportsSslDeployment(agent.agentVersion, minimumPatch)) {
    const minimumVersion = sslMode === 'letsencrypt' ? '0.7.1' : '0.7.0'
    throw createError({ statusCode: 409, statusMessage: `Update this agent to version ${minimumVersion} or newer first` })
  }
  const metrics = agent.lastMetrics as Record<string, unknown> | null
  if (!metrics?.zimbra) throw createError({ statusCode: 400, statusMessage: 'No Zimbra snapshot for this agent' })

  const request: ZimbraSslDeployRequest = { sslMode, domains: parseDomains(body?.domains) }
  if (sslMode === 'letsencrypt') {
    const email = String(body?.email || '').trim()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({ statusCode: 400, statusMessage: 'A valid ACME email address is required' })
    }
    request.email = email
  } else {
    const requestUrl = getRequestURL(event)
    const forwardedProtocol = String(getHeader(event, 'x-forwarded-proto') || '').split(',')[0].trim().toLowerCase()
    const secureUpload = forwardedProtocol === 'https' || requestUrl.protocol === 'https:' || requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
    if (!secureUpload) {
      throw createError({ statusCode: 400, statusMessage: 'Premium certificate upload requires HTTPS' })
    }
    request.certificatePem = requirePem(body?.certificatePem, 'Server certificate', '-----BEGIN CERTIFICATE-----')
    request.privateKeyPem = requirePem(body?.privateKeyPem, 'Private key', '-----BEGIN')
    request.caChainPem = requirePem(body?.caChainPem, 'CA chain', '-----BEGIN CERTIFICATE-----')
  }

  const job = createZimbraSslJob(id, sslMode, request.domains)
  const actor = String(session.email || session.sub || 'unknown')

  void (async () => {
    let success = false
    let errorCode: string | undefined
    let certificate: Record<string, string> | undefined

    try {
      const result = await deployZimbraSsl(id, request)
      success = result.success && !!result.details
      errorCode = result.error
      if (success && result.details) {
        completeZimbraSslJob(job.id, result.details)
        certificate = {
          subject: result.details.subject,
          notAfter: result.details.notAfter,
          fingerprint: result.details.fingerprint,
          backupId: result.details.backupId,
        }
      } else {
        errorCode ||= 'zimbra_ssl_deployment_failed'
        failZimbraSslJob(job.id, errorCode)
      }
    } catch (error) {
      errorCode = deploymentErrorCode(error)
      failZimbraSslJob(job.id, errorCode)
    }

    await prisma.auditLog.create({
      data: {
        actor,
        action: 'ZIMBRA_SSL_DEPLOY',
        target: id,
        details: {
          hostname: agent.hostname,
          sslMode,
          domains: request.domains,
          deploymentId: job.id,
          success,
          ...(errorCode ? { error: errorCode } : {}),
          ...(certificate ? { certificate } : {}),
        },
        result: success ? 'success' : 'failure',
      },
    }).catch(error => console.error('[ZimbraSSL] Failed to write audit log:', error))
  })()

  setResponseStatus(event, 202)
  return { success: true, deploymentId: job.id, status: job.status }
})
