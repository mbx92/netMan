<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p class="page-kicker mb-2">Operations</p>
        <h1 class="type-headline">Infrastructure dashboard</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Live view of devices, reachability, and fabric ports
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="ops-chip ops-chip--live">TELEMETRY</span>
        <span class="ops-chip">SITE SCOPE · ALL</span>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="type-mono text-base-content/60">DEVICES</div>
            <div class="type-metric mt-1">{{ stats?.totals?.devices || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Monitor class="w-6 h-6 text-primary" :stroke-width="2" />
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
            <div class="type-mono text-base-content/60">ONLINE</div>
            <div class="type-metric mt-1 text-success">{{ stats?.totals?.online || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-success/10 border border-success/20 flex items-center justify-center">
            <div class="w-3 h-3 rounded-full bg-success pulse-dot"></div>
          </div>
        </div>
        <div class="mt-3 type-mono text-base-content/60">
          {{ onlinePercentage }}% reachability
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="type-mono text-base-content/60">OFFLINE</div>
            <div class="type-metric mt-1 text-error">{{ stats?.totals?.offline || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-error/10 border border-error/20 flex items-center justify-center">
            <WifiOff class="w-6 h-6 text-error" :stroke-width="2" />
          </div>
        </div>
        <div class="mt-3 type-mono text-base-content/60">
          Needs attention
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="type-mono text-base-content/60">PORTS</div>
            <div class="type-metric mt-1">{{ stats?.totals?.ports || 0 }}</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center">
            <EthernetPort class="w-6 h-6 text-primary" :stroke-width="2" />
          </div>
        </div>
        <div class="mt-3 type-mono text-base-content/60">
          Monitored interfaces
        </div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Device Types Distribution -->
      <div class="lg:col-span-2 infra-panel infra-panel--rail p-6">
        <div class="flex items-center justify-between mb-4 gap-2">
          <h2 class="type-card-title">Devices by type</h2>
          <span class="type-mono text-base-content/50">INVENTORY</span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <template v-for="(count, type) in stats?.byType" :key="type">
            <div class="flex items-center gap-3 p-3 rounded-none bg-base-200/50">
              <div :class="['w-10 h-10 rounded-none flex items-center justify-center', getTypeColor(type as string)]">
                <component :is="getTypeIcon(type as string)" class="w-5 h-5" :stroke-width="2" />
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
      <div class="infra-panel p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="type-card-title">Recent activity</h2>
          <NuxtLink to="/audit" class="type-mono text-primary hover:underline">VIEW ALL</NuxtLink>
        </div>
        <div class="space-y-3">
          <div v-if="!stats?.recentLogs?.length" class="text-base-content/60 text-sm py-4 text-center">
            No recent activity
          </div>
          <div v-for="log in stats?.recentLogs?.slice(0, 5)" :key="log.id" class="flex items-start gap-3">
            <div :class="['w-8 h-8 rounded-none flex items-center justify-center shrink-0', getActionColor(log.action)]">
              <component :is="getActionIcon(log.action)" class="w-4 h-4" :stroke-width="2" />
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
    <div v-if="stats?.recentOffline?.length" class="mt-6 bg-base-100 border border-base-300 rounded-none p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-none bg-error/20 flex items-center justify-center">
          <AlertCircle class="w-5 h-5 text-error" :stroke-width="2" />
        </div>
        <div>
          <h2 class="type-card-title">Offline Devices</h2>
          <p class="type-body-sm text-base-content/60">These devices need attention</p>
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
    <div class="mt-6 bg-base-100 border border-base-300 rounded-none p-6">
      <h2 class="type-card-title mb-4">Quick Actions</h2>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/devices/create" class="btn btn-primary gap-2">
          <Plus class="w-4 h-4" :stroke-width="2" />
          Add Device
        </NuxtLink>
        <button class="btn btn-outline" @click="refreshStats">
          <RefreshCw class="w-4 h-4" :stroke-width="2" />
          Refresh
        </button>
        <NuxtLink to="/topology" class="btn btn-outline">
          <Waypoints class="w-4 h-4" :stroke-width="2" />
          View Topology
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircle,
  Box,
  CircleDot,
  EthernetPort,
  Monitor,
  Plus,
  Printer,
  RefreshCw,
  Router,
  Server,
  Tv,
  Waypoints,
  Wifi,
  WifiOff,
} from '@lucide/vue'

const { format: formatTimeAgo } = useFormatTimeAgo()

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
  const icons: Record<string, typeof Monitor> = {
    SMART_TV: Tv,
    PC_WINDOWS: Monitor,
    PC_LINUX: Monitor,
    SERVER_LINUX: Server,
    PRINTER: Printer,
    VM: Box,
    ROUTER: Router,
    SWITCH: EthernetPort,
    ACCESS_POINT: Wifi,
    OTHER: Monitor,
  }
  return icons[type] || Monitor
}

// Action display helpers
function getActionColor(action: string): string {
  if (action.includes('CREATE')) return 'bg-success/20 text-success'
  if (action.includes('DELETE')) return 'bg-error/20 text-error'
  if (action.includes('UPDATE')) return 'bg-info/20 text-info'
  if (action.includes('WAKE')) return 'bg-warning/20 text-warning'
  return 'bg-base-300 text-base-content'
}

function getActionIcon(_action: string) {
  return CircleDot
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

</script>
