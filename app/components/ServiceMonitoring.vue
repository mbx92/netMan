<template>
  <div class="animate-fade-in">
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p class="page-kicker mb-2">Monitoring</p>
        <h1 class="type-headline">{{ title }} Monitoring</h1>
        <p class="type-body-sm text-base-content/60 mt-1">{{ module === 'zimbra' ? 'Service health, mail queues, and storage across your mail servers.' : 'Service status, active jails, and banned IPs across your servers.' }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink v-if="module === 'zimbra'" to="/zimbra/accounts" class="btn btn-outline gap-2">
          <Users class="w-4 h-4" /> Accounts
        </NuxtLink>
        <button class="btn btn-outline gap-2" :disabled="pending" @click="refresh()">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending }" /> Refresh
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="mb-6 border border-error/40 bg-error/10 p-4">
      Unable to load monitoring data. Try Refresh. Previously loaded snapshots may be out of date.
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="infra-panel p-4"><p class="text-sm text-base-content/60">Reporting hosts</p><p class="text-3xl font-semibold mt-2">{{ hosts.length }}</p></div>
      <div class="infra-panel p-4"><p class="text-sm text-base-content/60">Online agents</p><p class="text-3xl font-semibold mt-2">{{ hosts.filter(online).length }}</p></div>
      <div class="infra-panel p-4"><p class="text-sm text-base-content/60">Hosts needing review</p><p class="text-3xl font-semibold mt-2">{{ hosts.filter(needsReview).length }}</p></div>
    </div>
    <div class="infra-panel p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
      <label class="flex-1">
        <span class="sr-only">Search hosts</span>
        <input v-model="search" type="search" class="input input-bordered w-full" placeholder="Search hostname, name, or IP..." />
      </label>
      <label>
        <span class="sr-only">Filter hosts</span>
        <select v-model="filter" class="select select-bordered w-full">
          <option value="all">All hosts</option>
          <option value="review">Needs review</option>
          <option value="online">Agent online</option>
          <option value="offline">Agent offline</option>
        </select>
      </label>
      <span class="text-xs text-base-content/60">Auto-refresh every 30s</span>
    </div>

    <div v-if="pending && !data" class="infra-panel p-12 text-center" role="status">
      <span class="loading loading-spinner text-primary"></span><p class="mt-3">Loading monitoring data...</p>
    </div>
    <div v-else-if="!hosts.length && !error" class="infra-panel p-10 text-center">
      <div class="mx-auto flex w-full max-w-[36rem] flex-col items-center">
        <component :is="module === 'zimbra' ? Mail : Shield" class="w-10 h-10 mb-4 text-base-content/40" />
        <h2 class="type-card-title">No {{ title }} snapshots yet</h2>
        <p class="type-body-sm text-base-content/60 mt-2 w-full leading-6">
          Enable {{ title }} monitoring in your Linux agent configuration, restart the agent, and wait for its first heartbeat. Hosts appear here after they report a snapshot.
        </p>
        <NuxtLink to="/agents" class="btn btn-primary mt-5">View agents</NuxtLink>
      </div>
    </div>
    <div v-else-if="hosts.length && !filteredHosts.length" class="infra-panel p-10 text-center text-base-content/60">No hosts match your filters.</div>

    <div class="space-y-6">
      <article v-for="agent in filteredHosts" :key="agent.id" class="infra-panel overflow-hidden">
        <div class="p-5 border-b border-base-300 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div>
            <NuxtLink :to="`/agents/${agent.id}`" class="type-card-title text-primary hover:underline">{{ agent.name || agent.hostname }}</NuxtLink>
            <p class="text-sm text-base-content/60 mt-1">{{ agent.hostname }} <span v-if="agent.lastIp">&middot; {{ agent.lastIp }}</span></p>
            <p class="text-xs text-base-content/60 mt-2">Snapshot: {{ formatDate(snapshot(agent)?.checkedAt) }} &middot; Last heartbeat: {{ formatDate(agent.lastSeen) }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="badge" :class="agentBadgeClass(agent)">{{ agentStateLabel(agent) }}</span>
            <span class="badge" :class="needsReview(agent) ? 'badge-warning' : 'badge-success'">{{ statusLabel(agent) }}</span>
            <span v-if="oldSnapshot(agent)" class="badge badge-warning">Snapshot over 5 min old</span>
          </div>
        </div>
        <div v-if="snapshotNotice(agent)" class="px-5 py-3 bg-warning/10 text-sm">{{ snapshotNotice(agent) }}</div>

        <div v-if="module === 'zimbra' && agent.lastMetrics?.zimbra" class="p-5 space-y-5">
          <p class="text-sm text-base-content/60">Version: {{ agent.lastMetrics.zimbra.version || 'Unavailable' }}</p>
          <ZimbraNetworkMonitoring :agent="agent" />
          <div v-if="Object.keys(agent.lastMetrics.zimbra.errors || {}).length" class="border border-warning/40 bg-warning/10 p-3 text-sm" role="status">
            <p class="font-medium mb-1">Some checks could not be completed</p>
            <p v-for="(message, check) in agent.lastMetrics.zimbra.errors" :key="check"><span class="font-mono">{{ check }}</span>: {{ message }}</p>
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section>
              <h3 class="font-semibold mb-3">Services</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="(service, name) in agent.lastMetrics.zimbra.services" :key="name" class="flex justify-between items-center gap-3 border border-base-300 p-3">
                  <span class="text-sm break-all">{{ name }}</span><span class="badge badge-sm" :class="service.status === 'running' ? 'badge-success' : 'badge-error'">{{ service.status }}</span>
                </div>
              </div>
              <p v-if="!Object.keys(agent.lastMetrics.zimbra.services || {}).length" class="text-sm text-base-content/60">Service status unavailable.</p>
            </section>
            <section>
              <h3 class="font-semibold mb-3">Mail queue</h3>
              <template v-if="agent.lastMetrics.zimbra.queue">
                <div class="grid grid-cols-3 gap-2 mb-3">
                  <div v-for="metric in queueMetrics(agent.lastMetrics.zimbra.queue)" :key="metric.label" class="bg-base-200 p-3"><p class="text-xs text-base-content/60">{{ metric.label }}</p><p class="text-2xl font-semibold mt-1">{{ number(metric.value) }}</p></div>
                </div>
                <div class="flex flex-wrap gap-2"><span v-for="(count, name) in agent.lastMetrics.zimbra.queue.counts" :key="name" class="badge badge-ghost">{{ name }}: {{ count }}</span></div>
              </template>
              <p v-else class="text-sm text-base-content/60">Queue counts unavailable. This host may not run an MTA, or the queue check failed.</p>
              <h3 class="font-semibold mt-6 mb-3">Storage</h3>
              <div v-for="storage in agent.lastMetrics.zimbra.storage || []" :key="storage.mountpoint" class="mb-3">
                <div class="flex justify-between gap-2 text-sm mb-1"><span class="font-mono break-all">{{ storage.mountpoint }}</span><span>{{ storage.percent.toFixed(1) }}%</span></div>
                <progress class="progress progress-primary w-full" :value="storage.percent" max="100" :aria-label="`${storage.mountpoint} usage`"></progress>
                <p class="text-xs text-base-content/60">{{ bytes(storage.usedBytes) }} used / {{ bytes(storage.totalBytes) }} total</p>
              </div>
              <p v-if="!agent.lastMetrics.zimbra.storage?.length" class="text-sm text-base-content/60">Storage data unavailable.</p>
              <p class="text-xs text-base-content/50 mt-2">Filesystem usage; paths may share the same filesystem.</p>
            </section>
          </div>
        </div>

        <div v-if="module === 'fail2ban' && agent.lastMetrics?.fail2ban" class="p-5 space-y-4">
          <p v-if="agent.lastMetrics.fail2ban.error" class="border border-warning/40 bg-warning/10 p-3 text-sm" role="status">Status check failed: {{ agent.lastMetrics.fail2ban.error }}</p>
          <p v-if="agent.lastMetrics.fail2ban.partial" class="border border-warning/40 bg-warning/10 p-3 text-sm">Partial snapshot: totals include only successfully read jails. Failed checks are shown as unavailable.</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div v-for="metric in jailMetrics(agent.lastMetrics.fail2ban)" :key="metric.label" class="bg-base-200 p-3"><p class="text-xs text-base-content/60">{{ metric.label }}</p><p class="text-2xl font-semibold mt-1">{{ metric.value }}</p></div>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead><tr><th>Jail</th><th>Currently failed</th><th>Total failed</th><th>Currently banned</th><th>Total banned</th><th>Banned IPs</th></tr></thead>
              <tbody>
                <tr v-for="jail in agent.lastMetrics.fail2ban.jails" :key="jail.name">
                  <td class="font-medium">{{ jail.name }}<p v-if="jail.error" class="text-warning text-xs mt-1">{{ jail.error }}</p></td>
                  <td>{{ jail.error ? unavailable : number(jail.currentlyFailed) }}</td><td>{{ jail.error ? unavailable : number(jail.totalFailed) }}</td>
                  <td>{{ jail.error ? unavailable : number(jail.currentlyBanned) }}</td><td>{{ jail.error ? unavailable : number(jail.totalBanned) }}</td>
                  <td>
                    <span v-if="jail.error" class="text-base-content/60">Unavailable</span>
                    <details v-else-if="jail.bannedIps?.length"><summary class="cursor-pointer text-primary">{{ jail.bannedIps.length }} IPs</summary><div class="font-mono text-xs max-h-48 overflow-y-auto mt-2"><p v-for="ip in jail.bannedIps" :key="ip">{{ ip }}</p></div></details>
                    <span v-else class="text-base-content/60">None</span>
                  </td>
                </tr>
                <tr v-if="!agent.lastMetrics.fail2ban.jails?.length"><td colspan="6" class="text-center py-6 text-base-content/60">{{ agent.lastMetrics.fail2ban.error ? 'Jail data unavailable.' : 'No active jails.' }}</td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-base-content/50">Totals are reported by Fail2Ban and can reset when the service or jail restarts.</p>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Mail, RefreshCw, Shield, Users } from '@lucide/vue'
import type { Fail2BanSnapshot, MonitoringAgent, ZimbraSnapshot } from '~/types/service-monitoring'

const props = defineProps<{ module: 'zimbra' | 'fail2ban' }>()
const title = computed(() => props.module === 'zimbra' ? 'Zimbra' : 'Fail2Ban')
const { data, pending, error, refresh } = await useFetch<MonitoringAgent[]>(() => `/api/agents/monitoring?module=${props.module}`)
const search = ref('')
const filter = ref('all')
const now = ref(0)
const snapshot = (agent: MonitoringAgent) => agent.lastMetrics?.[props.module]
const hosts = computed(() => (data.value || []).filter(agent => snapshot(agent)))
const online = (agent: MonitoringAgent) => agent.status === 'ONLINE'
const realtimeConnected = (agent: MonitoringAgent) => online(agent) && agent.isConnected
const oldSnapshot = (agent: MonitoringAgent) => {
  const checked = Date.parse(snapshot(agent)?.checkedAt || '')
  return !Number.isFinite(checked) || (now.value > 0 && now.value - checked > 5 * 60_000)
}
function needsReview(agent: MonitoringAgent) {
  if (!online(agent) || oldSnapshot(agent)) return true
  const zimbra = agent.lastMetrics?.zimbra
  const fail2ban = agent.lastMetrics?.fail2ban
  return props.module === 'zimbra'
    ? !zimbra?.healthy || !!Object.keys(zimbra.errors || {}).length || (!!zimbra.ssl && zimbra.ssl.status !== 'valid')
    : !fail2ban?.running || !!fail2ban.error || !!fail2ban.partial
}
function statusLabel(agent: MonitoringAgent) {
  if (props.module === 'zimbra') {
    const s = agent.lastMetrics?.zimbra
    if (!s || s.errors?.services) return 'Service status unknown'
    return s.healthy ? 'Services running' : s.status === 'degraded' ? 'Services degraded' : 'Service status unknown'
  }
  const s = agent.lastMetrics?.fail2ban
  if (s?.status === 'stopped') return 'Fail2Ban stopped'
  if (!s || s.error) return 'Service status unknown'
  return s.partial ? 'Partial snapshot' : s.running ? 'Fail2Ban running' : 'Service status unknown'
}
function agentStateLabel(agent: MonitoringAgent) {
  if (realtimeConnected(agent)) return 'Agent connected'
  if (online(agent)) return 'Agent online'
  return 'Agent disconnected'
}
function agentBadgeClass(agent: MonitoringAgent) {
  if (online(agent)) return 'badge-success'
  return 'badge-ghost'
}
function snapshotNotice(agent: MonitoringAgent) {
  const stale = oldSnapshot(agent)
  if (!stale && online(agent)) return ''
  if (online(agent)) return 'Agent is online, but this module snapshot is older than 5 minutes. Showing the last completed monitoring sample.'
  return 'Agent is disconnected. Showing the last reported snapshot; current service state is not confirmed.'
}
const filteredHosts = computed(() => hosts.value.filter(agent => {
  const matches = `${agent.name || ''} ${agent.hostname} ${agent.lastIp || ''}`.toLowerCase().includes(search.value.toLowerCase().trim())
  return matches && (filter.value === 'all' || (filter.value === 'review' && needsReview(agent)) || (filter.value === 'online' && online(agent)) || (filter.value === 'offline' && !online(agent)))
}))
const formatDate = formatAbsoluteTime
const number = (value: number) => new Intl.NumberFormat('en-US').format(value)
const unavailable = 'Unavailable'
const bytes = (value?: number) => value == null ? 'Unavailable' : `${(value / 1024 ** 3).toFixed(1)} GiB`
const queueMetrics = (q: NonNullable<ZimbraSnapshot['queue']>) => [{ label: 'Total queued', value: q.total }, { label: 'Deferred', value: q.deferred }, { label: 'Active', value: q.active }]
const jailMetrics = (s: Fail2BanSnapshot) => [
  { label: 'Active jails', value: s.error ? unavailable : number(s.jailCount) },
  { label: s.partial ? 'Currently banned (partial)' : 'Currently banned', value: s.error ? unavailable : number(s.currentlyBanned) },
  { label: s.partial ? 'Total banned (partial)' : 'Total banned', value: s.error ? unavailable : number(s.totalBanned) },
]
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
    if (!pending.value && !document.hidden) void refresh()
  }, 30_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
