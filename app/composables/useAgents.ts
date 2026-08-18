export interface AgentMetricsSnapshot {
  cpuPerCore?: number[]
  swapPercent?: number | null
  netRxBytesPerSec?: number | null
  netTxBytesPerSec?: number | null
  diskReadBytesPerSec?: number | null
  diskWriteBytesPerSec?: number | null
  loadAvg1?: number | null
  loadAvg5?: number | null
  loadAvg15?: number | null
  partitions?: { mountpoint: string; percent: number }[]
  topProcesses?: { name: string; pid: number; cpuPercent: number; memPercent: number }[]
  loggedInUsers?: string[]
}

export interface AgentSummary {
  id: string
  deviceId: string | null
  platform: 'WINDOWS' | 'LINUX' | 'MACOS'
  hostname: string
  alias: string | null
  /** Windows only, and only present on the single-agent GET (never in the list). */
  vncPassword?: string | null
  osVersion: string | null
  agentVersion: string | null
  status: 'PENDING' | 'ONLINE' | 'OFFLINE'
  lastSeen: string | null
  lastIp: string | null
  lastCpuPercent: number | null
  lastMemPercent: number | null
  lastDiskPercent: number | null
  lastUptimeSec: number | null
  lastMetrics: AgentMetricsSnapshot | null
  diskInfo: { model?: string; vendor?: string }[] | null
  memorySlotsTotal: number | null
  memorySlotsUsed: number | null
  memoryType: string | null
  enrollExpiresAt: string | null
  isConnected: boolean
  device: { id: string; name: string; ip: string | null; siteId: string | null } | null
}

export interface InstallCommands {
  windows: string
  linux: string
  macos: string
}

export function useAgents() {
  async function createAgent(payload: { platform: 'WINDOWS' | 'LINUX' | 'MACOS'; name?: string; siteId?: string }) {
    return $fetch<{ agent: AgentSummary; install: InstallCommands; tokenExpiresAt: string }>('/api/agents', {
      method: 'POST',
      body: payload,
    })
  }

  async function deleteAgent(id: string) {
    return $fetch(`/api/agents/${id}`, { method: 'DELETE' })
  }

  async function regenerateInstall(id: string) {
    return $fetch<{ install: InstallCommands; tokenExpiresAt: string }>(`/api/agents/${id}/generate-install`, {
      method: 'POST',
    })
  }

  async function updateAgentAlias(id: string, alias: string | null) {
    return $fetch<{ success: boolean; alias: string | null }>(`/api/agents/${id}`, {
      method: 'PUT',
      body: { alias },
    })
  }

  async function killProcess(id: string, pid: number, name?: string) {
    return $fetch<{ success: boolean }>(`/api/agents/${id}/kill-process`, {
      method: 'POST',
      body: { pid, name },
    })
  }

  async function sendPowerAction(id: string, action: 'restart' | 'shutdown') {
    return $fetch<{ success: boolean }>(`/api/agents/${id}/power`, {
      method: 'POST',
      body: { action },
    })
  }

  return { createAgent, deleteAgent, regenerateInstall, updateAgentAlias, killProcess, sendPowerAction }
}
