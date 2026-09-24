import { requireSession } from '../../../../../utils/require-session'
import { getZimbraSslJob } from '../../../../../utils/zimbra-ssl-jobs'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.roleName !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Administrator access required' })
  }

  const agentId = getRouterParam(event, 'id')
  const deploymentId = getRouterParam(event, 'deploymentId')
  if (!agentId || !deploymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Agent and deployment IDs are required' })
  }

  const job = getZimbraSslJob(deploymentId)
  if (!job || job.agentId !== agentId) {
    throw createError({ statusCode: 404, statusMessage: 'SSL deployment status is no longer available' })
  }

  return job
})
