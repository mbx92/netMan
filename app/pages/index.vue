<template>
  <div class="animate-fade-in">
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p class="page-kicker mb-2">Operations</p>
        <h1 class="type-headline">Infrastructure dashboard</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Attention, reachability, IPAM, and integration health
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="ops-chip ops-chip--live">TELEMETRY</span>
        <span class="ops-chip">SITE · {{ selectedSiteName }}</span>
        <select
          v-model="selectedSiteId"
          class="select select-bordered w-48"
          aria-label="Filter by site"
        >
          <option value="">All sites</option>
          <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" @click="refreshStats">
          <RefreshCw class="w-4 h-4" :stroke-width="2" />
          Refresh
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <div class="badge badge-success badge-sm">{{ stats?.totals?.online || 0 }} online</div>
          <div class="badge badge-error badge-sm">{{ stats?.totals?.offline || 0 }} offline</div>
          <div v-if="stats?.totals?.unknown" class="badge badge-ghost badge-sm">
            {{ stats.totals.unknown }} unknown
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="type-mono text-base-content/60">REACHABILITY</div>
            <div class="type-metric mt-1">{{ stats?.totals?.reachability || 0 }}%</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-success/10 border border-success/20 flex items-center justify-center">
            <div class="w-3 h-3 rounded-full bg-success pulse-dot"></div>
          </div>
        </div>
        <div class="mt-3 type-mono text-base-content/60">
          {{ stats?.totals?.online || 0 }} of {{ stats?.totals?.devices || 0 }} reachable
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="type-mono text-base-content/60">PORTS</div>
            <div class="type-metric mt-1">{{ stats?.ports?.utilization || 0 }}%</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center">
            <EthernetPort class="w-6 h-6 text-primary" :stroke-width="2" />
          </div>
        </div>
        <div class="mt-3">
          <progress
            class="progress progress-primary"
            :value="stats?.ports?.utilization || 0"
            max="100"
          />
          <div class="mt-2 type-mono text-base-content/60">
            {{ stats?.ports?.assigned || 0 }} assigned · {{ stats?.ports?.free || 0 }} free
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <div class="type-mono text-base-content/60">IPAM</div>
            <div class="type-metric mt-1">{{ stats?.ipam?.utilization || 0 }}%</div>
          </div>
          <div class="w-12 h-12 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Grid2x2 class="w-6 h-6 text-primary" :stroke-width="2" />
          </div>
        </div>
        <div class="mt-3">
          <progress
            class="progress"
            :class="ipamProgressClass"
            :value="stats?.ipam?.utilization || 0"
            max="100"
          />
          <div class="mt-2 type-mono text-base-content/60">
            {{ stats?.ipam?.used || 0 }} used · {{ stats?.ipam?.free || 0 }} free
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="infra-panel infra-panel--rail p-4">
        <div class="flex items-center justify-between mb-2 gap-2">
          <h2 class="type-card-title">Attention queue</h2>
          <span class="type-mono text-base-content/50">{{ stats?.attention?.length || 0 }}</span>
        </div>

        <div v-if="!stats?.attention?.length" class="py-6 text-center text-base-content/60 type-body-sm">
          All clear
        </div>
        <ul v-else class="divide-y divide-base-300">
          <li v-for="item in stats.attention" :key="item.id">
            <NuxtLink :to="item.href" class="flex items-center gap-2 py-1.5 hover:bg-base-200/60 -mx-1 px-1">
              <span
                class="w-1.5 h-1.5 shrink-0"
                :class="item.severity === 'error' ? 'bg-error' : 'bg-warning'"
              />
              <span class="text-sm truncate flex-1" :title="item.detail">{{ item.title }}</span>
              <span class="type-mono text-base-content/40 shrink-0">{{ formatAttentionTime(item.at) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div class="infra-panel p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="type-card-title">Integrations</h2>
          <span class="type-mono text-base-content/50">{{ integrationSummary }}</span>
        </div>
        <div v-if="!stats?.integrations?.length" class="py-6 text-center text-base-content/60 type-body-sm">
          No integrations configured
        </div>
        <ul v-else class="space-y-2">
          <li v-for="item in stats.integrations" :key="`${item.kind}-${item.id}`">
            <NuxtLink :to="item.href" class="flex items-start gap-2 hover:bg-base-200/60 -mx-1 px-1 py-1">
              <div class="w-7 h-7 rounded-none bg-base-200 flex items-center justify-center shrink-0">
                <component :is="integrationIcon(item.kind)" class="w-4 h-4" :stroke-width="2" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ item.name }}</span>
                  <span class="badge badge-sm" :class="syncBadgeClass(item.status)">{{ item.status }}</span>
                </div>
                <div class="type-mono text-base-content/50 truncate">
                  {{ integrationKindLabel(item.kind) }}
                  · {{ item.lastSync ? formatTimeAgo(item.lastSync) : 'Never synced' }}
                </div>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div class="infra-panel p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="type-card-title">Recent activity</h2>
          <NuxtLink to="/audit" class="type-mono text-primary hover:underline">VIEW ALL</NuxtLink>
        </div>
        <div v-if="!stats?.recentLogs?.length" class="py-6 text-center text-base-content/60 type-body-sm">
          No recent activity
        </div>
        <ul v-else class="space-y-2">
          <li v-for="log in stats.recentLogs" :key="log.id" class="flex items-start gap-2">
            <div
              class="w-7 h-7 rounded-none flex items-center justify-center shrink-0"
              :class="getActionColor(log.action, log.result)"
            >
              <CircleDot class="w-4 h-4" :stroke-width="2" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ formatAction(log.action) }}</div>
              <div class="type-mono text-base-content/50 truncate">
                {{ log.actor }} · {{ log.target }}
              </div>
              <div class="type-mono text-base-content/40">{{ formatTimeAgo(log.createdAt) }}</div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="infra-panel p-6 mb-6">
      <div class="flex items-center justify-between mb-4 gap-2">
        <h2 class="type-card-title">IPAM snapshot</h2>
        <NuxtLink to="/ipam" class="type-mono text-primary hover:underline">VIEW ALL</NuxtLink>
      </div>
      <div v-if="!stats?.ipam?.items?.length" class="py-8 text-center text-base-content/60 type-body-sm">
        No IP ranges in this scope
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="range in stats.ipam.items" :key="range.id">
          <div class="flex items-center justify-between gap-3 mb-1">
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ range.name }}</div>
              <div class="type-mono text-base-content/50 truncate">
                {{ range.network }}
                <span v-if="range.site"> · {{ range.site.name }}</span>
              </div>
            </div>
            <div class="type-mono text-base-content/60 shrink-0">
              {{ range.usedIps }}/{{ range.totalIps }} · {{ range.usagePercent }}%
            </div>
          </div>
          <progress
            class="progress"
            :class="usageProgressClass(range.usagePercent)"
            :value="range.usagePercent"
            max="100"
          />
        </div>
      </div>
    </div>

    <div class="infra-panel p-6 mb-6">
      <div class="flex items-center justify-between mb-4 gap-2">
        <h2 class="type-card-title">Devices by type</h2>
        <span class="type-mono text-base-content/50">INVENTORY</span>
      </div>
      <div v-if="!stats?.byType?.length" class="py-8 text-center text-base-content/60 type-body-sm">
        No devices in this scope
      </div>
      <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div
          v-for="item in stats.byType"
          :key="item.code"
          class="flex items-center gap-3 p-3 bg-base-200/50"
        >
          <div
            class="w-10 h-10 rounded-none flex items-center justify-center border border-base-300"
            :style="typeSwatch(item.color)"
          >
            <component :is="getTypeIcon(item.code)" class="w-5 h-5" :stroke-width="2" />
          </div>
          <div>
            <div class="font-semibold">{{ item.count }}</div>
            <div class="text-xs text-base-content/60">{{ item.name }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none p-6">
      <h2 class="type-card-title mb-4">Quick actions</h2>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/devices/create" class="btn btn-primary gap-2">
          <Plus class="w-4 h-4" :stroke-width="2" />
          Add Device
        </NuxtLink>
        <NuxtLink to="/discovery" class="btn btn-outline gap-2">
          <Radar class="w-4 h-4" :stroke-width="2" />
          Discovery
        </NuxtLink>
        <NuxtLink to="/topology" class="btn btn-outline gap-2">
          <Waypoints class="w-4 h-4" :stroke-width="2" />
          Topology
        </NuxtLink>
        <NuxtLink to="/ipam" class="btn btn-outline gap-2">
          <Grid2x2 class="w-4 h-4" :stroke-width="2" />
          IPAM
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Box,
  CircleDot,
  Database,
  EthernetPort,
  Grid2x2,
  Monitor,
  Plus,
  Printer,
  Radar,
  RefreshCw,
  Router,
  Server,
  Tv,
  Video,
  Waypoints,
  Wifi,
} from '@lucide/vue'

interface Site {
  id: string
  name: string
}

interface DashboardStats {
  totals: {
    devices: number
    online: number
    offline: number
    unknown: number
    maintenance: number
    reachability: number
  }
  ports: { total: number; assigned: number; free: number; utilization: number }
  ipam: {
    ranges: number
    used: number
    free: number
    total: number
    utilization: number
    items: {
      id: string
      name: string
      network: string
      site: { id: string; name: string } | null
      totalIps: number
      usedIps: number
      freeIps: number
      usagePercent: number
    }[]
  }
  byType: { code: string; name: string; color: string | null; count: number }[]
  integrations: {
    kind: 'mikrotik' | 'proxmox' | 'nas' | 'hikvision'
    id: string
    name: string
    host: string | null
    lastSync: string | null
    isActive: boolean
    status: 'ok' | 'stale' | 'never' | 'inactive'
    href: string
  }[]
  attention: {
    id: string
    kind: string
    severity: 'error' | 'warning'
    title: string
    detail: string
    href: string
    at: string
  }[]
  recentLogs: {
    id: string
    actor: string
    action: string
    target: string
    result: string
    createdAt: string
  }[]
}

const { format: formatTimeAgo } = useFormatTimeAgo()
const route = useRoute()
const router = useRouter()

const selectedSiteId = computed({
  get: () => (typeof route.query.site === 'string' ? route.query.site : ''),
  set: (value: string) => {
    const query = { ...route.query }
    if (value) query.site = value
    else delete query.site
    void router.replace({ query })
  },
})

const { data: sitesData } = await useFetch<{ sites: Site[] }>('/api/sites')
const sites = computed(() => sitesData.value?.sites || [])
const selectedSiteName = computed(() => {
  if (!selectedSiteId.value) return 'ALL'
  return sites.value.find(s => s.id === selectedSiteId.value)?.name || 'ALL'
})

const { data: stats, refresh: refreshStats } = await useFetch<DashboardStats>('/api/stats', {
  query: computed(() => (selectedSiteId.value ? { siteId: selectedSiteId.value } : {})),
  watch: [selectedSiteId],
})

const ipamProgressClass = computed(() => usageProgressClass(stats.value?.ipam?.utilization || 0))

const integrationSummary = computed(() => {
  const items = stats.value?.integrations || []
  if (!items.length) return 'NONE'
  const healthy = items.filter(i => i.status === 'ok').length
  return `${healthy}/${items.length} OK`
})

function formatAttentionTime(at: string | null | undefined): string {
  if (!at) return ''
  const ms = new Date(at).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return ''
  return formatTimeAgo(at)
}

function usageProgressClass(percent: number): string {
  if (percent >= 80) return 'progress-error'
  if (percent >= 50) return 'progress-warning'
  return 'progress-success'
}

function syncBadgeClass(status: string): string {
  if (status === 'ok') return 'badge-success'
  if (status === 'stale' || status === 'never') return 'badge-warning'
  return 'badge-ghost'
}

function integrationKindLabel(kind: string): string {
  if (kind === 'mikrotik') return 'MikroTik'
  if (kind === 'proxmox') return 'Proxmox'
  if (kind === 'nas') return 'NAS'
  if (kind === 'hikvision') return 'Hikvision'
  return kind
}

function integrationIcon(kind: string) {
  if (kind === 'mikrotik') return Router
  if (kind === 'proxmox') return Server
  if (kind === 'nas') return Database
  return Video
}

function typeSwatch(color: string | null): Record<string, string> {
  if (!color) return {}
  return {
    backgroundColor: `${color}1a`,
    color,
  }
}

function getTypeIcon(type: string) {
  if (type.includes('SWITCH')) return EthernetPort
  if (type.includes('ROUTER')) return Router
  if (type.includes('ACCESS_POINT')) return Wifi
  if (type.includes('SERVER')) return Server
  if (type.includes('VM')) return Box
  if (type.includes('PRINTER')) return Printer
  if (type.includes('TV')) return Tv
  if (type.includes('PC')) return Monitor
  return Monitor
}

function getActionColor(action: string, result: string): string {
  if (result === 'failed') return 'bg-error/20 text-error'
  if (action.includes('CREATE') || action.includes('IMPORT')) return 'bg-success/20 text-success'
  if (action.includes('DELETE') || action.includes('FAIL')) return 'bg-error/20 text-error'
  if (action.includes('UPDATE') || action.includes('SYNC') || action.includes('CAPTURE')) return 'bg-info/20 text-info'
  if (action.includes('WAKE')) return 'bg-warning/20 text-warning'
  return 'bg-base-300 text-base-content'
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}
</script>
