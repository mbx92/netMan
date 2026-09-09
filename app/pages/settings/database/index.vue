<template>
  <div class="container mx-auto p-6 max-w-7xl">
    <div class="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center mb-8">
      <div>
        <h1 class="type-headline">Database</h1>
        <p class="type-body-sm text-base-content/60 mt-1">Connection pool, retention, and storage footprint</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-base-content/60 cursor-pointer">
          <input v-model="autoRefresh" type="checkbox" class="toggle toggle-sm toggle-primary" />
          Auto-refresh
        </label>
        <button class="btn btn-ghost btn-sm gap-2" :disabled="poolPending || retentionPending" @click="refreshAll()">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': poolPending || retentionPending }" :stroke-width="2" />
          Refresh
        </button>
      </div>
    </div>

    <div v-if="poolError" class="alert alert-error mb-6">
      <span>{{ poolError.data?.statusMessage || poolError.message || 'Failed to load pool status' }}</span>
    </div>
    <div v-if="retentionError" class="alert alert-error mb-6">
      <span>{{ retentionError.data?.statusMessage || retentionError.message || 'Failed to load retention report' }}</span>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-base-100 border border-base-300 rounded-none p-4">
        <p class="type-body-sm text-base-content/60">Active</p>
        <p class="text-2xl font-semibold text-success">{{ pool?.byState.active || 0 }}</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-none p-4">
        <p class="type-body-sm text-base-content/60">Idle</p>
        <p class="text-2xl font-semibold text-base-content/70">{{ pool?.byState.idle || 0 }}</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-none p-4">
        <p class="type-body-sm text-base-content/60">Total / Limit</p>
        <p class="text-2xl font-semibold" :class="usageColor">
          {{ pool?.total ?? 0 }} / {{ pool?.config.connectionLimit ?? '-' }}
        </p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-none p-4">
        <p class="type-body-sm text-base-content/60">Metric Samples</p>
        <p class="text-2xl font-semibold">{{ formatNumber(retention?.counts.agentMetricSamples || 0) }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <div class="xl:col-span-2 bg-base-100 border border-base-300 rounded-none p-4">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div>
            <p class="type-card-title">Data Retention</p>
            <p class="type-body-sm text-base-content/60">Automatic cleanup runs at the configured sweep interval</p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="retentionForm.enabled" type="checkbox" class="toggle toggle-primary toggle-sm" />
            Enabled
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="form-control">
            <span class="label-text">Agent metric history</span>
            <div class="join">
              <input v-model.number="retentionForm.agentMetricSampleDays" type="number" min="1" max="3650" class="input input-bordered join-item w-full" />
              <span class="join-item px-3 inline-flex items-center bg-base-200 border border-base-300 text-sm">days</span>
            </div>
          </label>
          <label class="form-control">
            <span class="label-text">Audit logs</span>
            <div class="join">
              <input v-model.number="retentionForm.auditLogDays" type="number" min="1" max="3650" class="input input-bordered join-item w-full" />
              <span class="join-item px-3 inline-flex items-center bg-base-200 border border-base-300 text-sm">days</span>
            </div>
          </label>
          <label class="form-control">
            <span class="label-text">Read/resolved notifications</span>
            <div class="join">
              <input v-model.number="retentionForm.notificationResolvedDays" type="number" min="1" max="3650" class="input input-bordered join-item w-full" />
              <span class="join-item px-3 inline-flex items-center bg-base-200 border border-base-300 text-sm">days</span>
            </div>
          </label>
          <label class="form-control">
            <span class="label-text">Ended remote sessions</span>
            <div class="join">
              <input v-model.number="retentionForm.remoteSessionEndedDays" type="number" min="1" max="3650" class="input input-bordered join-item w-full" />
              <span class="join-item px-3 inline-flex items-center bg-base-200 border border-base-300 text-sm">days</span>
            </div>
          </label>
          <label class="form-control md:col-span-2">
            <span class="label-text">Sweep interval</span>
            <div class="join">
              <input v-model.number="sweepIntervalHours" type="number" min="1" max="168" class="input input-bordered join-item w-full" />
              <span class="join-item px-3 inline-flex items-center bg-base-200 border border-base-300 text-sm">hours</span>
            </div>
          </label>
        </div>

        <div class="flex flex-wrap gap-3 mt-5">
          <button class="btn btn-primary gap-2" :disabled="savingRetention" @click="saveRetention">
            <Save class="w-4 h-4" :stroke-width="2" />
            Save
          </button>
          <button class="btn btn-outline gap-2" :disabled="pruning" @click="runPrune(true)">
            <Search class="w-4 h-4" :stroke-width="2" />
            Preview Cleanup
          </button>
          <button class="btn btn-error gap-2" :disabled="pruning" @click="runPrune(false)">
            <Trash2 class="w-4 h-4" :stroke-width="2" />
            Run Cleanup
          </button>
        </div>
      </div>

      <div class="bg-base-100 border border-base-300 rounded-none p-4">
        <p class="type-card-title mb-4">Retention Impact</p>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-base-content/60">Old metric rows</span>
            <span class="font-mono">{{ formatNumber(retention?.oldMetricSamples || 0) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-base-content/60">Agents</span>
            <span class="font-mono">{{ formatNumber(retention?.counts.agents || 0) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-base-content/60">Devices</span>
            <span class="font-mono">{{ formatNumber(retention?.counts.devices || 0) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-base-content/60">Ports</span>
            <span class="font-mono">{{ formatNumber(retention?.counts.networkPorts || 0) }}</span>
          </div>
          <div v-if="pruneResult" class="border-t border-base-300 pt-3 mt-3">
            <p class="font-medium mb-2">{{ pruneResult.dryRun ? 'Preview result' : 'Cleanup result' }}</p>
            <div v-for="(count, key) in pruneResult.pruned" :key="key" class="flex justify-between gap-3">
              <span class="text-base-content/60">{{ labelFor(key) }}</span>
              <span class="font-mono">{{ formatNumber(count) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
        <div class="p-4 border-b border-base-300">
          <p class="type-card-title">Top Agents by Stored Metrics</p>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr class="bg-base-200/50">
                <th>Agent</th>
                <th>Samples</th>
                <th>Last Snapshot</th>
                <th>Range</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in topAgents" :key="agent.id">
                <td>
                  <NuxtLink :to="`/agents/${agent.id}`" class="font-medium text-primary hover:underline">{{ agent.name }}</NuxtLink>
                  <div class="text-xs text-base-content/50">{{ agent.platform }} · {{ agent.status }}</div>
                </td>
                <td class="font-mono">{{ formatNumber(agent.metricSamples) }}</td>
                <td class="font-mono">{{ formatBytes(agent.lastMetricsBytes) }}</td>
                <td class="text-xs text-base-content/60">{{ formatRange(agent.firstMetricAt, agent.lastMetricAt) }}</td>
              </tr>
              <tr v-if="!topAgents.length">
                <td colspan="4" class="text-center text-base-content/50 py-6">No agent metric history</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
        <div class="p-4 border-b border-base-300">
          <p class="type-card-title">Top Devices by Stored Rows</p>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr class="bg-base-200/50">
                <th>Device</th>
                <th>Rows</th>
                <th>Metrics</th>
                <th>Ports / Sessions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in topDevices" :key="device.id">
                <td>
                  <NuxtLink :to="`/devices/${device.id}`" class="font-medium text-primary hover:underline">{{ device.name }}</NuxtLink>
                  <div class="text-xs text-base-content/50">{{ device.ip || device.hostname || device.typeCode }}</div>
                </td>
                <td class="font-mono">{{ formatNumber(device.storedRows) }}</td>
                <td class="font-mono">{{ formatNumber(device.metricSamples) }}</td>
                <td class="font-mono">{{ device.ports }} / {{ device.sessions }}</td>
              </tr>
              <tr v-if="!topDevices.length">
                <td colspan="4" class="text-center text-base-content/50 py-6">No devices</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
        <div class="p-4 border-b border-base-300">
          <p class="type-card-title">Largest Tables</p>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr class="bg-base-200/50">
                <th>Table</th>
                <th>Estimated Rows</th>
                <th>Total Size</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="table in retention?.tables || []" :key="table.table">
                <td class="font-mono">{{ table.table }}</td>
                <td class="font-mono">{{ formatNumber(table.estimatedRows) }}</td>
                <td class="font-mono">{{ formatBytes(table.totalBytes) }}</td>
              </tr>
              <tr v-if="!retention?.tables.length">
                <td colspan="3" class="text-center text-base-content/50 py-6">No table size data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
        <div class="p-4 border-b border-base-300">
          <p class="type-card-title">Largest Integration Snapshots</p>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr class="bg-base-200/50">
                <th>Source</th>
                <th>Host</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="snapshot in topSnapshots" :key="`${snapshot.type}-${snapshot.id}`">
                <td>
                  <span class="font-medium">{{ snapshot.name }}</span>
                  <div class="text-xs text-base-content/50">{{ snapshot.type }}</div>
                </td>
                <td class="font-mono text-xs">{{ snapshot.host || '-' }}</td>
                <td class="font-mono">{{ formatBytes(snapshot.snapshotBytes) }}</td>
              </tr>
              <tr v-if="!topSnapshots.length">
                <td colspan="3" class="text-center text-base-content/50 py-6">No integration snapshots</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden mt-6">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>PID</th>
              <th>State</th>
              <th>App</th>
              <th>Client</th>
              <th>State Since</th>
              <th>Wait Event</th>
              <th>Query</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="conn in pool?.connections" :key="conn.pid">
              <td class="font-mono text-xs">{{ conn.pid }}</td>
              <td>
                <span :class="['badge', stateBadge(conn.state)]">{{ conn.state || 'unknown' }}</span>
              </td>
              <td class="text-xs">{{ conn.application_name || '-' }}</td>
              <td class="text-xs font-mono">{{ conn.client_addr || 'local' }}</td>
              <td class="text-xs text-base-content/60">{{ formatSince(conn.state_change) }}</td>
              <td class="text-xs">{{ conn.wait_event || '-' }}</td>
              <td class="text-xs font-mono max-w-md truncate" :title="conn.query || ''">{{ conn.query || '-' }}</td>
            </tr>
            <tr v-if="!pool?.connections.length">
              <td colspan="7" class="text-center text-base-content/50 py-6">No connections</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, Save, Search, Trash2 } from '@lucide/vue'

interface DbConnection {
  pid: number
  state: string | null
  application_name: string | null
  client_addr: string | null
  query_start: string | null
  state_change: string | null
  wait_event_type: string | null
  wait_event: string | null
  query: string | null
}

interface DbPoolStatus {
  config: { connectionLimit: number, poolTimeout: number, connectTimeout: number }
  maxConnections: number | null
  total: number
  byState: Record<string, number>
  connections: DbConnection[]
}

interface RetentionSettings {
  enabled: boolean
  agentMetricSampleDays: number
  auditLogDays: number
  notificationResolvedDays: number
  remoteSessionEndedDays: number
  sweepIntervalMs: number
}

interface AgentStorage {
  id: string
  name: string
  hostname: string
  platform: string
  status: string
  deviceId: string | null
  lastSeen: string | null
  metricSamples: number
  firstMetricAt: string | null
  lastMetricAt: string | null
  lastMetricsBytes: number
  hardwareBytes: number
}

interface DeviceStorage {
  id: string
  name: string
  ip: string | null
  hostname: string | null
  typeCode: string
  agentId: string | null
  metricSamples: number
  ports: number
  sessions: number
  childDevices: number
  storedRows: number
}

interface TableStorage {
  table: string
  estimatedRows: number
  totalBytes: number
}

interface SnapshotStorage {
  type: string
  id: string
  name: string
  host: string | null
  snapshotBytes: number
}

interface RetentionReport {
  generatedAt: string
  settings: RetentionSettings
  counts: Record<string, number>
  oldMetricSamples: number
  tables: TableStorage[]
  agents: AgentStorage[]
  devices: DeviceStorage[]
  snapshots: SnapshotStorage[]
}

interface PruneResult {
  dryRun: boolean
  settings: RetentionSettings
  cutoffs: Record<string, string>
  pruned: Record<string, number>
}

const { data: pool, error: poolError, pending: poolPending, refresh: refreshPool } = await useFetch<DbPoolStatus>('/api/system/db-pool')
const {
  data: retention,
  error: retentionError,
  pending: retentionPending,
  refresh: refreshRetention,
} = await useFetch<RetentionReport>('/api/system/retention')

const retentionForm = reactive<RetentionSettings>({
  enabled: true,
  agentMetricSampleDays: 14,
  auditLogDays: 180,
  notificationResolvedDays: 90,
  remoteSessionEndedDays: 180,
  sweepIntervalMs: 6 * 60 * 60 * 1000,
})
const savingRetention = ref(false)
const pruning = ref(false)
const pruneResult = ref<PruneResult | null>(null)
const autoRefresh = ref(true)
let pollInterval: ReturnType<typeof setInterval> | null = null

const sweepIntervalHours = computed({
  get: () => Math.max(1, Math.round(retentionForm.sweepIntervalMs / 60 / 60 / 1000)),
  set: (hours: number) => {
    retentionForm.sweepIntervalMs = Math.max(1, Number(hours) || 1) * 60 * 60 * 1000
  },
})

watch(() => retention.value?.settings, (settings) => {
  if (!settings) return
  Object.assign(retentionForm, settings)
}, { immediate: true })

watch(autoRefresh, (enabled) => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (enabled && import.meta.client) {
    pollInterval = setInterval(() => refreshPool(), 5000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const usageColor = computed(() => {
  const total = pool.value?.total ?? 0
  const limit = pool.value?.config.connectionLimit ?? 0
  if (!limit) return ''
  const ratio = total / limit
  if (ratio >= 1) return 'text-error'
  if (ratio >= 0.7) return 'text-warning'
  return 'text-success'
})

const topAgents = computed(() => (retention.value?.agents || []).slice(0, 10))
const topDevices = computed(() => (retention.value?.devices || []).slice(0, 10))
const topSnapshots = computed(() => (retention.value?.snapshots || []).filter((row) => row.snapshotBytes > 0).slice(0, 10))

async function refreshAll() {
  await Promise.all([refreshPool(), refreshRetention()])
}

async function saveRetention() {
  savingRetention.value = true
  try {
    await $fetch('/api/system/retention', { method: 'PUT', body: retentionForm })
    await refreshRetention()
  } finally {
    savingRetention.value = false
  }
}

async function runPrune(dryRun: boolean) {
  if (!dryRun) {
    const ok = await confirmDialog({
      title: 'Run database cleanup',
      message: 'Delete rows older than the configured retention windows?',
      confirmLabel: 'Run Cleanup',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
  }
  pruning.value = true
  try {
    pruneResult.value = await $fetch<PruneResult>('/api/system/retention/prune', {
      method: 'POST',
      body: { dryRun },
    })
    await refreshRetention()
  } finally {
    pruning.value = false
  }
}

function stateBadge(state: string | null): string {
  switch (state) {
    case 'active': return 'badge-success'
    case 'idle': return 'badge-ghost'
    case 'idle in transaction': return 'badge-warning'
    default: return 'badge-outline'
  }
}

function formatSince(value: string | null): string {
  if (!value) return '-'
  const diffMs = Date.now() - new Date(value).getTime()
  const seconds = Math.max(0, Math.floor(diffMs / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatRange(first: string | null, last: string | null): string {
  if (!first || !last) return '-'
  return `${new Date(first).toLocaleDateString()} - ${new Date(last).toLocaleDateString()}`
}

function labelFor(key: string): string {
  switch (key) {
    case 'agentMetricSamples': return 'Metric samples'
    case 'auditLogs': return 'Audit logs'
    case 'notifications': return 'Notifications'
    case 'remoteSessions': return 'Remote sessions'
    default: return key
  }
}
</script>
