export interface ZimbraSnapshot {
  ssl?: {
    status: string
    path: string
    subject?: string
    issuer?: string
    dnsNames?: string[]
    notBefore?: string
    notAfter?: string
    daysRemaining: number
    error?: string
  }
  accounts?: ZimbraAccountSnapshot
  available: boolean
  healthy: boolean
  status: string
  version?: string
  services: Record<string, { status: string }>
  queue?: { total: number; deferred: number; active: number; counts: Record<string, number> }
  storage?: { mountpoint: string; percent: number; totalBytes?: number; usedBytes?: number }[]
  errors?: Record<string, string>
  checkedAt: string
}

export interface ZimbraAccountSnapshot {
  total?: number
  active?: number
  locked?: number
  closed?: number
  maintenance?: number
  byStatus?: Record<string, number>
  quotaWarningCount?: number
  inactiveCount?: number
  entries?: ZimbraAccountHealth[]
  accounts?: ZimbraAccountHealth[]
  errors?: Record<string, string>
  checkedAt?: string
  truncated?: boolean
}

export interface ZimbraAccountHealth {
  email: string
  displayName?: string
  status?: string
  quotaPercent?: number
  quotaUsedBytes?: number
  quotaLimitBytes?: number
  mailboxSizeBytes?: number
  lastLogonAt?: string
  warnings?: string[]
}

export interface Fail2BanSnapshot {
  available: boolean
  running: boolean
  status: string
  jailCount: number
  currentlyBanned: number
  totalBanned: number
  partial?: boolean
  error?: string
  checkedAt: string
  jails: {
    name: string
    currentlyFailed: number
    totalFailed: number
    currentlyBanned: number
    totalBanned: number
    bannedIps: string[]
    error?: string
  }[]
}

export interface MonitoringAgent {
  id: string
  name?: string | null
  alias?: string | null
  hostname: string
  lastIp?: string | null
  status: string
  isConnected: boolean
  lastSeen?: string | null
  lastMetrics?: { zimbra?: ZimbraSnapshot; fail2ban?: Fail2BanSnapshot } | null
}
