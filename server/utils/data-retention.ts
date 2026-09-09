import type { Prisma } from '@prisma/client'
import prisma from './prisma'

const SETTINGS_KEY = 'dataRetention'
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_SWEEP_MS = 6 * 60 * 60 * 1000

export interface DataRetentionSettings {
  enabled: boolean
  agentMetricSampleDays: number
  auditLogDays: number
  notificationResolvedDays: number
  remoteSessionEndedDays: number
  sweepIntervalMs: number
}

export interface DataRetentionPruneResult {
  dryRun: boolean
  settings: DataRetentionSettings
  cutoffs: Record<string, string>
  pruned: {
    agentMetricSamples: number
    auditLogs: number
    notifications: number
    remoteSessions: number
  }
}

type RawSettings = Partial<Record<keyof DataRetentionSettings, unknown>>

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function defaultSettings(): DataRetentionSettings {
  return {
    enabled: process.env.DATA_RETENTION_ENABLED !== 'false',
    agentMetricSampleDays: numberFromEnv('AGENT_METRIC_RETENTION_DAYS', 14),
    auditLogDays: numberFromEnv('AUDIT_LOG_RETENTION_DAYS', 180),
    notificationResolvedDays: numberFromEnv('NOTIFICATION_RETENTION_DAYS', 90),
    remoteSessionEndedDays: numberFromEnv('REMOTE_SESSION_RETENTION_DAYS', 180),
    sweepIntervalMs: numberFromEnv('DATA_RETENTION_SWEEP_MS', DEFAULT_SWEEP_MS),
  }
}

function clampDays(value: unknown, fallback: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(3650, Math.max(1, n))
}

function clampSweepMs(value: unknown, fallback: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(7 * DAY_MS, Math.max(60_000, n))
}

function normalizeSettings(raw: RawSettings = {}, base = defaultSettings()): DataRetentionSettings {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    agentMetricSampleDays: clampDays(raw.agentMetricSampleDays, base.agentMetricSampleDays),
    auditLogDays: clampDays(raw.auditLogDays, base.auditLogDays),
    notificationResolvedDays: clampDays(raw.notificationResolvedDays, base.notificationResolvedDays),
    remoteSessionEndedDays: clampDays(raw.remoteSessionEndedDays, base.remoteSessionEndedDays),
    sweepIntervalMs: clampSweepMs(raw.sweepIntervalMs, base.sweepIntervalMs),
  }
}

function jsonSize(value: unknown): number {
  if (value == null) return 0
  return Buffer.byteLength(JSON.stringify(value))
}

function cutoff(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

export async function getDataRetentionSettings(): Promise<DataRetentionSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null)
  const value = row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
    ? row.value as RawSettings
    : {}
  return normalizeSettings(value)
}

export async function updateDataRetentionSettings(input: RawSettings): Promise<DataRetentionSettings> {
  const current = await getDataRetentionSettings()
  const settings = normalizeSettings(input, current)
  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: settings as unknown as Prisma.InputJsonObject },
    update: { value: settings as unknown as Prisma.InputJsonObject },
  })
  return settings
}

export async function pruneDataRetention(options: { dryRun?: boolean } = {}): Promise<DataRetentionPruneResult> {
  const dryRun = options.dryRun ?? false
  const settings = await getDataRetentionSettings()
  const metricCutoff = cutoff(settings.agentMetricSampleDays)
  const auditCutoff = cutoff(settings.auditLogDays)
  const notificationCutoff = cutoff(settings.notificationResolvedDays)
  const remoteSessionCutoff = cutoff(settings.remoteSessionEndedDays)

  if (!settings.enabled) {
    return {
      dryRun,
      settings,
      cutoffs: {
        agentMetricSamples: metricCutoff.toISOString(),
        auditLogs: auditCutoff.toISOString(),
        notifications: notificationCutoff.toISOString(),
        remoteSessions: remoteSessionCutoff.toISOString(),
      },
      pruned: { agentMetricSamples: 0, auditLogs: 0, notifications: 0, remoteSessions: 0 },
    }
  }

  const where = {
    agentMetricSamples: { recordedAt: { lt: metricCutoff } },
    auditLogs: { createdAt: { lt: auditCutoff } },
    notifications: {
      createdAt: { lt: notificationCutoff },
      OR: [{ resolvedAt: { not: null } }, { isRead: true }],
    },
    remoteSessions: { endedAt: { not: null, lt: remoteSessionCutoff } },
  } as const

  const [agentMetricSamples, auditLogs, notifications, remoteSessions] = dryRun
    ? await Promise.all([
      prisma.agentMetricSample.count({ where: where.agentMetricSamples }),
      prisma.auditLog.count({ where: where.auditLogs }),
      prisma.notification.count({ where: where.notifications }),
      prisma.remoteSession.count({ where: where.remoteSessions }),
    ])
    : await Promise.all([
      prisma.agentMetricSample.deleteMany({ where: where.agentMetricSamples }).then((r) => r.count),
      prisma.auditLog.deleteMany({ where: where.auditLogs }).then((r) => r.count),
      prisma.notification.deleteMany({ where: where.notifications }).then((r) => r.count),
      prisma.remoteSession.deleteMany({ where: where.remoteSessions }).then((r) => r.count),
    ])

  return {
    dryRun,
    settings,
    cutoffs: {
      agentMetricSamples: metricCutoff.toISOString(),
      auditLogs: auditCutoff.toISOString(),
      notifications: notificationCutoff.toISOString(),
      remoteSessions: remoteSessionCutoff.toISOString(),
    },
    pruned: { agentMetricSamples, auditLogs, notifications, remoteSessions },
  }
}

export async function getDataRetentionReport() {
  const settings = await getDataRetentionSettings()
  const metricCutoff = cutoff(settings.agentMetricSampleDays)
  const countJobs = {
    devices: prisma.device.count(),
    agents: prisma.agent.count(),
    agentMetricSamples: prisma.agentMetricSample.count(),
    auditLogs: prisma.auditLog.count(),
    notifications: prisma.notification.count(),
    remoteSessions: prisma.remoteSession.count(),
    networkPorts: prisma.networkPort.count(),
    ipRanges: prisma.iPRange.count(),
    ipAllocations: prisma.iPAllocation.count(),
    mikrotikDevices: prisma.mikrotikDevice.count(),
    nasDevices: prisma.nAS.count(),
    hikvisionDevices: prisma.hikvisionDevice.count(),
    hikvisionChannels: prisma.hikvisionChannel.count(),
    proxmoxNodes: prisma.proxmoxNode.count(),
  }
  const countEntries = Object.entries(countJobs)

  const [
    countValues,
    metricGroups,
    agents,
    devices,
    tableSizes,
    integrationSnapshots,
    oldMetricSamples,
  ] = await Promise.all([
    Promise.all(countEntries.map(([, promise]) => promise)),
    prisma.agentMetricSample.groupBy({
      by: ['agentId'],
      _count: { _all: true },
      _min: { recordedAt: true },
      _max: { recordedAt: true },
    }),
    prisma.agent.findMany({
      select: {
        id: true,
        hostname: true,
        alias: true,
        platform: true,
        status: true,
        deviceId: true,
        lastSeen: true,
        lastMetrics: true,
        diskInfo: true,
        printerInfo: true,
      },
    }),
    prisma.device.findMany({
      select: {
        id: true,
        name: true,
        ip: true,
        hostname: true,
        typeCode: true,
        agent: { select: { id: true } },
        _count: { select: { ports: true, sessions: true, childDevices: true } },
      },
    }),
    prisma.$queryRaw<{ table: string; estimatedRows: bigint; totalBytes: bigint }[]>`
      SELECT relname AS table,
             n_live_tup::bigint AS "estimatedRows",
             pg_total_relation_size(relid)::bigint AS "totalBytes"
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 20
    `.catch(() => []),
    Promise.all([
      prisma.mikrotikDevice.findMany({ select: { id: true, name: true, host: true, lastSnapshot: true } }),
      prisma.nAS.findMany({ select: { id: true, name: true, ipAddress: true, lastSnapshot: true } }),
      prisma.hikvisionDevice.findMany({ select: { id: true, name: true, host: true, lastSnapshot: true } }),
      prisma.proxmoxNode.findMany({ select: { id: true, name: true, host: true, lastSnapshot: true } }),
    ]),
    prisma.agentMetricSample.count({ where: { recordedAt: { lt: metricCutoff } } }),
  ])
  const counts = Object.fromEntries(
    countEntries.map(([key], index) => [key, countValues[index] || 0]),
  ) as Record<keyof typeof countJobs, number>

  const sampleCountByAgent = new Map(metricGroups.map((row) => [row.agentId, {
    count: row._count._all,
    firstRecordedAt: row._min.recordedAt,
    lastRecordedAt: row._max.recordedAt,
  }]))

  const agentRows = agents.map((agent) => {
    const samples = sampleCountByAgent.get(agent.id)
    return {
      id: agent.id,
      name: agent.alias || agent.hostname,
      hostname: agent.hostname,
      platform: agent.platform,
      status: agent.status,
      deviceId: agent.deviceId,
      lastSeen: agent.lastSeen,
      metricSamples: samples?.count || 0,
      firstMetricAt: samples?.firstRecordedAt || null,
      lastMetricAt: samples?.lastRecordedAt || null,
      lastMetricsBytes: jsonSize(agent.lastMetrics),
      hardwareBytes: jsonSize(agent.diskInfo) + jsonSize(agent.printerInfo),
    }
  }).sort((a, b) => (b.metricSamples - a.metricSamples) || (b.lastMetricsBytes - a.lastMetricsBytes))

  const deviceRows = devices.map((device) => {
    const agentId = device.agent?.id || null
    const metricSamples = agentId ? sampleCountByAgent.get(agentId)?.count || 0 : 0
    return {
      id: device.id,
      name: device.name,
      ip: device.ip,
      hostname: device.hostname,
      typeCode: device.typeCode,
      agentId,
      metricSamples,
      ports: device._count.ports,
      sessions: device._count.sessions,
      childDevices: device._count.childDevices,
      storedRows: 1 + device._count.ports + device._count.sessions + device._count.childDevices + metricSamples,
    }
  }).sort((a, b) => b.storedRows - a.storedRows)

  const [mikrotik, nas, hikvision, proxmox] = integrationSnapshots
  const snapshotRows = [
    ...mikrotik.map((row) => ({ type: 'MikroTik', id: row.id, name: row.name, host: row.host, snapshotBytes: jsonSize(row.lastSnapshot) })),
    ...nas.map((row) => ({ type: 'NAS', id: row.id, name: row.name, host: row.ipAddress, snapshotBytes: jsonSize(row.lastSnapshot) })),
    ...hikvision.map((row) => ({ type: 'Hikvision', id: row.id, name: row.name, host: row.host, snapshotBytes: jsonSize(row.lastSnapshot) })),
    ...proxmox.map((row) => ({ type: 'Proxmox', id: row.id, name: row.name, host: row.host, snapshotBytes: jsonSize(row.lastSnapshot) })),
  ].sort((a, b) => b.snapshotBytes - a.snapshotBytes)

  return {
    generatedAt: new Date().toISOString(),
    settings,
    counts,
    oldMetricSamples,
    tables: tableSizes.map((row) => ({
      table: row.table,
      estimatedRows: Number(row.estimatedRows),
      totalBytes: Number(row.totalBytes),
    })),
    agents: agentRows,
    devices: deviceRows,
    snapshots: snapshotRows,
  }
}
