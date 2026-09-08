import { isIP } from 'node:net'
import prisma from '../../../utils/prisma'
import { requireSession } from '../../../utils/require-session'
import { isRateLimited } from '../../../utils/rate-limit'
import { MAIL_PORTS, checkMailPort } from '../../../utils/mail-port-check'

export default defineEventHandler(async (event) => {
  await requireSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID required' })
  const agent = await prisma.agent.findUnique({ where: { id }, select: { hostname: true, lastIp: true, lastMetrics: true } })
  if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  const metrics = agent.lastMetrics as Record<string, unknown> | null
  if (!metrics?.zimbra) throw createError({ statusCode: 400, statusMessage: 'No Zimbra snapshot for this agent' })
  const body = await readBody(event)
  const target = body?.target ?? 'hostname'
  if (target !== 'hostname' && target !== 'ip') throw createError({ statusCode: 400, statusMessage: 'Choose hostname or IP' })
  // Only registered agent destinations and the fixed mail port list are accepted.
  const host = target === 'ip' ? agent.lastIp : agent.hostname
  if (!host || (!isIP(host) && (host.length > 253 || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)))) {
    throw createError({ statusCode: 400, statusMessage: 'Agent has no valid target address' })
  }
  if (isRateLimited(`mail-ports:${id}`, 1, 10_000)) throw createError({ statusCode: 429, statusMessage: 'Wait 10 seconds before checking again' })
  const ports = await Promise.all(MAIL_PORTS.map(async ({ port, service }) => ({ service, ...await checkMailPort(host, port) })))
  return { host, checkedAt: new Date().toISOString(), source: 'netMan server', ports }
})
