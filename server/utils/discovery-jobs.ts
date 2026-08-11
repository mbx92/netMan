import type { DiscoveredDevice } from './discovery'

export type DiscoveryJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface DiscoveryJob {
  id: string
  networks: string[]
  status: DiscoveryJobStatus
  totalHosts: number
  scannedHosts: number
  foundHosts: number
  results: DiscoveredDevice[]
  subnetProgress: { [network: string]: { scanned: number; total: number; found: number } }
  startedAt?: Date
  completedAt?: Date
  error?: string
}

const globalForDiscovery = globalThis as typeof globalThis & {
  __discoveryJobs?: Map<string, DiscoveryJob>
}

/** Survives Nitro HMR so GET/POST share the same in-memory jobs */
export const discoveryJobs =
  globalForDiscovery.__discoveryJobs ??
  (globalForDiscovery.__discoveryJobs = new Map<string, DiscoveryJob>())
