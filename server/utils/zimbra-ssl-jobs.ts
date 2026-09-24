import { randomUUID } from 'node:crypto'
import type { CommandResult } from './agent-commands'

export type ZimbraSslJobStatus = 'pending' | 'succeeded' | 'failed'

export interface ZimbraSslJob {
  id: string
  agentId: string
  status: ZimbraSslJobStatus
  mode: 'letsencrypt' | 'premium'
  domains: string[]
  createdAt: string
  updatedAt: string
  details?: CommandResult['details']
  error?: string
}

const jobs = new Map<string, ZimbraSslJob>()
const JOB_TTL_MS = 60 * 60_000

export function createZimbraSslJob(agentId: string, mode: ZimbraSslJob['mode'], domains: string[]): ZimbraSslJob {
  const now = new Date().toISOString()
  const job: ZimbraSslJob = {
    id: randomUUID(),
    agentId,
    status: 'pending',
    mode,
    domains: [...domains],
    createdAt: now,
    updatedAt: now,
  }
  jobs.set(job.id, job)

  const cleanup = setTimeout(() => jobs.delete(job.id), JOB_TTL_MS)
  cleanup.unref?.()
  return { ...job, domains: [...job.domains] }
}

export function completeZimbraSslJob(id: string, details: CommandResult['details']): void {
  const job = jobs.get(id)
  if (!job) return
  job.status = 'succeeded'
  job.updatedAt = new Date().toISOString()
  job.details = details
  delete job.error
}

export function failZimbraSslJob(id: string, error: string): void {
  const job = jobs.get(id)
  if (!job) return
  job.status = 'failed'
  job.updatedAt = new Date().toISOString()
  job.error = error
  delete job.details
}

export function getZimbraSslJob(id: string): ZimbraSslJob | undefined {
  const job = jobs.get(id)
  return job ? { ...job, domains: [...job.domains] } : undefined
}
