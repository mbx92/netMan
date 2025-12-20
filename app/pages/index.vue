<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Dashboard</h1>
      <p class="text-base-content/60 mt-1">Infrastructure overview and status</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-base-content/60 font-medium">Total Devices</div>
            <div class="text-3xl font-bold mt-1">{{ stats?.totals?.devices || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <div class="badge badge-success badge-sm">{{ stats?.totals?.online || 0 }} online</div>
          <div class="badge badge-error badge-sm">{{ stats?.totals?.offline || 0 }} offline</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-base-content/60 font-medium">Online</div>
            <div class="text-3xl font-bold mt-1 text-success">{{ stats?.totals?.online || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
            <div class="w-3 h-3 rounded-full bg-success pulse-dot"></div>
          </div>
        </div>
        <div class="mt-3 text-sm text-base-content/60">
          {{ onlinePercentage }}% of total devices
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-base-content/60 font-medium">Offline</div>
            <div class="text-3xl font-bold mt-1 text-error">{{ stats?.totals?.offline || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-xl bg-error/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
            </svg>
          </div>
        </div>
        <div class="mt-3 text-sm text-base-content/60">
          Needs attention
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-base-content/60 font-medium">Network Ports</div>
            <div class="text-3xl font-bold mt-1">{{ stats?.totals?.ports || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
        </div>
        <div class="mt-3 text-sm text-base-content/60">
          Monitored ports
        </div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Device Types Distribution -->
      <div class="lg:col-span-2 bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
        <h2 class="text-lg font-semibold mb-4">Devices by Type</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <template v-for="(count, type) in stats?.byType" :key="type">
            <div class="flex items-center gap-3 p-3 rounded-lg bg-base-200/50">
              <div :class="['w-10 h-10 rounded-lg flex items-center justify-center', getTypeColor(type as string)]">
                <component :is="getTypeIcon(type as string)" class="w-5 h-5" />
              </div>
              <div>
                <div class="font-semibold">{{ count }}</div>
                <div class="text-xs text-base-content/60">{{ getTypeLabel(type as string) }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Recent Activity</h2>
          <NuxtLink to="/audit" class="text-sm text-primary hover:underline">View all</NuxtLink>
        </div>
        <div class="space-y-3">
          <div v-if="!stats?.recentLogs?.length" class="text-base-content/60 text-sm py-4 text-center">
            No recent activity
          </div>
          <div v-for="log in stats?.recentLogs?.slice(0, 5)" :key="log.id" class="flex items-start gap-3">
            <div :class="['w-8 h-8 rounded-full flex items-center justify-center shrink-0', getActionColor(log.action)]">
              <component :is="getActionIcon(log.action)" class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ formatAction(log.action) }}</div>
              <div class="text-xs text-base-content/60">{{ formatTimeAgo(log.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Offline Devices Alert -->
    <div v-if="stats?.recentOffline?.length" class="mt-6 bg-base-100 rounded-xl shadow-lg border border-error/30 p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-lg bg-error/20 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <h2 class="text-lg font-semibold">Offline Devices</h2>
          <p class="text-sm text-base-content/60">These devices need attention</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr class="border-base-200">
              <th>Name</th>
              <th>Type</th>
              <th>IP</th>
              <th>Last Seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in stats.recentOffline" :key="device.id" class="border-base-200 hover:bg-base-200/50">
              <td class="font-medium">{{ device.name }}</td>
              <td>
                <span class="badge badge-sm">{{ getTypeLabel(device.typeCode) }}</span>
              </td>
              <td class="font-mono text-sm">{{ device.ip || '-' }}</td>
              <td class="text-sm text-base-content/60">{{ formatTimeAgo(device.lastSeen) }}</td>
              <td>
                <NuxtLink :to="`/devices/${device.id}`" class="btn btn-ghost btn-xs">
                  View
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mt-6 bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
      <h2 class="text-lg font-semibold mb-4">Quick Actions</h2>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/devices?action=add" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Device
        </NuxtLink>
        <button class="btn btn-outline" @click="refreshStats">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
        <NuxtLink to="/topology" class="btn btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>
          View Topology
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'

// Fetch dashboard stats
const { data: stats, refresh: refreshStats } = await useFetch('/api/stats')

// Calculate online percentage
const onlinePercentage = computed(() => {
  const total = stats.value?.totals?.devices || 0
  const online = stats.value?.totals?.online || 0
  if (total === 0) return 0
  return Math.round((online / total) * 100)
})

// Type display helpers
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    SMART_TV: 'Smart TV',
    PC_WINDOWS: 'Windows PC',
    PC_LINUX: 'Linux PC',
    SERVER_LINUX: 'Linux Server',
    PRINTER: 'Printer',
    VM: 'Virtual Machine',
    ROUTER: 'Router',
    SWITCH: 'Switch',
    ACCESS_POINT: 'Access Point',
    OTHER: 'Other',
  }
  return labels[type] || type
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    SMART_TV: 'bg-purple-500/20 text-purple-400',
    PC_WINDOWS: 'bg-blue-500/20 text-blue-400',
    PC_LINUX: 'bg-orange-500/20 text-orange-400',
    SERVER_LINUX: 'bg-green-500/20 text-green-400',
    PRINTER: 'bg-gray-500/20 text-gray-400',
    VM: 'bg-cyan-500/20 text-cyan-400',
    ROUTER: 'bg-emerald-500/20 text-emerald-400',
    SWITCH: 'bg-teal-500/20 text-teal-400',
    ACCESS_POINT: 'bg-indigo-500/20 text-indigo-400',
    OTHER: 'bg-slate-500/20 text-slate-400',
  }
  return colors[type] || 'bg-base-300 text-base-content'
}

function getTypeIcon(type: string) {
  // Return simple SVG component
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    class: 'w-5 h-5',
  }, [
    h('rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }),
    h('line', { x1: 12, y1: 17, x2: 12, y2: 21 }),
  ])
}

// Action display helpers
function getActionColor(action: string): string {
  if (action.includes('CREATE')) return 'bg-success/20 text-success'
  if (action.includes('DELETE')) return 'bg-error/20 text-error'
  if (action.includes('UPDATE')) return 'bg-info/20 text-info'
  if (action.includes('WAKE')) return 'bg-warning/20 text-warning'
  return 'bg-base-300 text-base-content'
}

function getActionIcon(action: string) {
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    class: 'w-4 h-4',
  }, [
    h('circle', { cx: 12, cy: 12, r: 10 }),
  ])
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
</script>
