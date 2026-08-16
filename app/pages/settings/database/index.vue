<template>
  <div class="container mx-auto p-6 max-w-6xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="type-headline">
          Database Connection Pool
        </h1>
        <p class="type-body-sm text-base-content/60 mt-1">Prisma / PostgreSQL connection pool status</p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-base-content/60 cursor-pointer">
          <input v-model="autoRefresh" type="checkbox" class="toggle toggle-sm toggle-primary" />
          Auto-refresh
        </label>
        <button class="btn btn-ghost btn-sm gap-2" :disabled="pending" @click="refresh()">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending }" :stroke-width="2" />
          Refresh
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-6">
      <span>{{ error.data?.statusMessage || error.message || 'Failed to load pool status' }}</span>
    </div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <p class="type-body-sm text-base-content/60">Active</p>
          <p class="text-2xl font-semibold text-success">{{ data?.byState.active || 0 }}</p>
        </div>
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <p class="type-body-sm text-base-content/60">Idle</p>
          <p class="text-2xl font-semibold text-base-content/70">{{ data?.byState.idle || 0 }}</p>
        </div>
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <p class="type-body-sm text-base-content/60">Total / Limit</p>
          <p class="text-2xl font-semibold" :class="usageColor">
            {{ data?.total ?? 0 }} / {{ data?.config.connectionLimit ?? '-' }}
          </p>
        </div>
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <p class="type-body-sm text-base-content/60">Server Max Connections</p>
          <p class="text-2xl font-semibold">{{ data?.maxConnections ?? '-' }}</p>
        </div>
      </div>

      <!-- Pool Config -->
      <div class="bg-base-100 border border-base-300 rounded-none p-4 mb-6">
        <p class="type-body-sm font-medium mb-3">Pool Configuration</p>
        <div class="flex flex-wrap gap-6 text-sm">
          <div>
            <span class="text-base-content/60">connection_limit:</span>
            <code class="ml-1 badge badge-ghost">{{ data?.config.connectionLimit }}</code>
          </div>
          <div>
            <span class="text-base-content/60">pool_timeout:</span>
            <code class="ml-1 badge badge-ghost">{{ data?.config.poolTimeout }}s</code>
          </div>
          <div>
            <span class="text-base-content/60">connect_timeout:</span>
            <code class="ml-1 badge badge-ghost">{{ data?.config.connectTimeout }}s</code>
          </div>
        </div>
      </div>

      <!-- Connections Table -->
      <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
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
              <tr v-for="conn in data?.connections" :key="conn.pid">
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
              <tr v-if="!data?.connections.length">
                <td colspan="7" class="text-center text-base-content/50 py-6">No connections</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'

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

const { data, error, pending, refresh } = await useFetch<DbPoolStatus>('/api/system/db-pool')

const autoRefresh = ref(true)
let pollInterval: ReturnType<typeof setInterval> | null = null

watch(autoRefresh, (enabled) => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (enabled && import.meta.client) {
    pollInterval = setInterval(() => refresh(), 5000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const usageColor = computed(() => {
  const total = data.value?.total ?? 0
  const limit = data.value?.config.connectionLimit ?? 0
  if (!limit) return ''
  const ratio = total / limit
  if (ratio >= 1) return 'text-error'
  if (ratio >= 0.7) return 'text-warning'
  return 'text-success'
})

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
</script>
