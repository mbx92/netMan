<template>
  <div class="animate-fade-in">
    <div class="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2 mb-3">
          <NuxtLink to="/zimbra" class="btn btn-ghost btn-sm btn-square" aria-label="Back to Zimbra monitoring">
            <ArrowLeft class="w-4 h-4" />
          </NuxtLink>
          <p class="page-kicker">Monitoring</p>
        </div>
        <h1 class="type-headline">Zimbra Accounts</h1>
        <p class="type-body-sm text-base-content/60 mt-1">Account status, quota pressure, and mailbox activity across reporting Zimbra hosts.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/zimbra" class="btn btn-outline gap-2">
          <Mail class="w-4 h-4" /> Service overview
        </NuxtLink>
        <button class="btn btn-outline gap-2" :disabled="pending" @click="refresh()">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending }" /> Refresh
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="mb-6 border border-error/40 bg-error/10 p-4">
      Unable to load Zimbra account data.
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <div class="infra-panel p-4">
        <p class="text-sm text-base-content/60">Zimbra hosts</p>
        <p class="text-3xl font-semibold mt-2">{{ zimbraHosts.length }}</p>
      </div>
      <div class="infra-panel p-4">
        <p class="text-sm text-base-content/60">Account snapshots</p>
        <p class="text-3xl font-semibold mt-2">{{ accountHosts.length }}</p>
      </div>
      <div class="infra-panel p-4">
        <p class="text-sm text-base-content/60">Tracked accounts</p>
        <p class="text-3xl font-semibold mt-2">{{ number(totalAccounts) }}</p>
      </div>
      <div class="infra-panel p-4">
        <p class="text-sm text-base-content/60">Accounts needing review</p>
        <p class="text-3xl font-semibold mt-2">{{ number(reviewCount) }}</p>
      </div>
    </div>

    <div class="infra-panel p-4 mb-6 flex flex-col xl:flex-row gap-3 xl:items-center">
      <label class="flex-1">
        <span class="sr-only">Search accounts</span>
        <input v-model="search" type="search" class="input input-bordered w-full" placeholder="Search email, display name, host, or IP..." />
      </label>
      <label class="xl:w-64">
        <span class="sr-only">Filter hosts</span>
        <select v-model="hostFilter" class="select select-bordered w-full">
          <option value="all">All Zimbra hosts</option>
          <option v-for="agent in zimbraHosts" :key="agent.id" :value="agent.id">{{ agent.name || agent.hostname }}</option>
        </select>
      </label>
      <label class="xl:w-52">
        <span class="sr-only">Filter account status</span>
        <select v-model="statusFilter" class="select select-bordered w-full">
          <option value="all">All statuses</option>
          <option v-for="status in statusOptions" :key="status" :value="status">{{ statusLabel(status) }}</option>
        </select>
      </label>
      <label class="xl:w-52">
        <span class="sr-only">Filter account issues</span>
        <select v-model="issueFilter" class="select select-bordered w-full">
          <option value="all">All accounts</option>
          <option value="quota">Quota warning</option>
          <option value="inactive">Inactive login</option>
          <option value="status">Non-active status</option>
          <option value="warnings">Any warning</option>
        </select>
      </label>
    </div>

    <div v-if="pending && !data" class="infra-panel p-12 text-center" role="status">
      <span class="loading loading-spinner text-primary"></span>
      <p class="mt-3">Loading Zimbra accounts...</p>
    </div>

    <div v-else-if="!zimbraHosts.length && !error" class="infra-panel p-10 text-center">
      <Mail class="w-10 h-10 mx-auto mb-4 text-base-content/40" />
      <h2 class="type-card-title">No Zimbra snapshots yet</h2>
      <p class="type-body-sm text-base-content/60 mt-2">Hosts appear here after Linux agents report Zimbra monitoring snapshots.</p>
    </div>

    <div v-else-if="!accountHosts.length" class="space-y-6">
      <div class="infra-panel p-10 text-center">
        <Users class="w-10 h-10 mx-auto mb-4 text-base-content/40" />
        <h2 class="type-card-title">No account snapshots yet</h2>
        <p class="type-body-sm text-base-content/60 mt-2">Zimbra hosts are reporting service data, but no account health payload has been received.</p>
      </div>
      <ZimbraAccountHostTable :agents="filteredHostSummaries" />
    </div>

    <div v-else-if="accountHosts.length && !accountRows.length" class="space-y-6">
      <div class="infra-panel p-10 text-center">
        <Users class="w-10 h-10 mx-auto mb-4 text-base-content/40" />
        <h2 class="type-card-title">No account detail rows</h2>
        <p class="type-body-sm text-base-content/60 mt-2">Account summaries are available from reporting hosts.</p>
      </div>
      <ZimbraAccountHostTable :agents="filteredHostSummaries" />
    </div>

    <div v-else-if="accountRows.length && !filteredRows.length" class="space-y-6">
      <div class="infra-panel p-10 text-center text-base-content/60">No accounts match your filters.</div>
      <ZimbraAccountHostTable :agents="filteredHostSummaries" />
    </div>

    <div v-else class="space-y-6">
      <div class="infra-panel overflow-hidden">
        <div class="px-5 py-4 border-b border-base-300 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 class="type-card-title">Accounts</h2>
            <p class="text-sm text-base-content/60">{{ number(filteredRows.length) }} of {{ number(accountRows.length) }} reported accounts</p>
          </div>
          <span v-if="partialAccountData" class="badge badge-warning">Partial account data</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Account</th>
                <th>Host</th>
                <th>Status</th>
                <th>Quota</th>
                <th>Mailbox</th>
                <th>Last login</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="`${row.agent.id}:${row.email}`">
                <td>
                  <p class="font-medium break-all">{{ row.email }}</p>
                  <p v-if="row.displayName" class="text-xs text-base-content/60 break-words">{{ row.displayName }}</p>
                </td>
                <td>
                  <NuxtLink :to="`/agents/${row.agent.id}`" class="text-primary hover:underline">{{ row.hostLabel }}</NuxtLink>
                  <p v-if="row.agent.lastIp" class="text-xs text-base-content/60 font-mono">{{ row.agent.lastIp }}</p>
                </td>
                <td>
                  <span class="badge badge-sm" :class="statusBadgeClass(row.normalizedStatus)">{{ statusLabel(row.normalizedStatus) }}</span>
                </td>
                <td class="min-w-44">
                  <template v-if="row.quotaPercent != null">
                    <div class="flex justify-between gap-2 text-sm mb-1">
                      <span>{{ row.quotaPercent.toFixed(1) }}%</span>
                      <span class="text-base-content/60">{{ bytes(row.quotaUsedBytes) }} / {{ bytes(row.quotaLimitBytes) }}</span>
                    </div>
                    <progress class="progress w-full" :class="row.quotaPercent >= 90 ? 'progress-error' : row.quotaPercent >= 80 ? 'progress-warning' : 'progress-primary'" :value="row.quotaPercent" max="100" :aria-label="`${row.email} quota usage`"></progress>
                  </template>
                  <span v-else class="text-base-content/60">Unavailable</span>
                </td>
                <td>{{ bytes(row.mailboxSizeBytes) }}</td>
                <td>{{ date(row.lastLogonAt) }}</td>
                <td>
                  <div v-if="row.issues.length" class="flex flex-wrap gap-1">
                    <span v-for="issue in row.issues" :key="issue" class="badge badge-warning badge-sm">{{ issue }}</span>
                  </div>
                  <span v-else class="text-base-content/60">None</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ZimbraAccountHostTable :agents="filteredHostSummaries" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Mail, RefreshCw, Users } from '@lucide/vue'
import type { MonitoringAgent, ZimbraAccountHealth, ZimbraAccountSnapshot } from '~/types/service-monitoring'

type AccountRow = ZimbraAccountHealth & {
  agent: MonitoringAgent
  hostLabel: string
  normalizedStatus: string
  quotaPercent: number | null
  issues: string[]
}

const { data, pending, error, refresh } = await useFetch<MonitoringAgent[]>('/api/agents/monitoring?module=zimbra')
useHead({ title: 'Zimbra Accounts' })

const search = ref('')
const hostFilter = ref('all')
const statusFilter = ref('all')
const issueFilter = ref('all')

const zimbraHosts = computed(() => (data.value || []).filter(agent => agent.lastMetrics?.zimbra))
const accountHosts = computed(() => zimbraHosts.value.filter(agent => agent.lastMetrics?.zimbra?.accounts))

const accountRows = computed<AccountRow[]>(() => {
  return accountHosts.value.flatMap((agent) => {
    const accounts = accountEntries(agent.lastMetrics?.zimbra?.accounts)
    return accounts.map((account) => {
      const normalizedStatus = normalizeStatus(account.status)
      const quotaPercent = normalizeQuotaPercent(account)
      return {
        ...account,
        agent,
        hostLabel: agent.name || agent.hostname,
        normalizedStatus,
        quotaPercent,
        issues: accountIssues(account, normalizedStatus, quotaPercent),
      }
    })
  })
})

const statusOptions = computed(() => {
  const statuses = new Set(accountRows.value.map(row => row.normalizedStatus))
  for (const agent of accountHosts.value) {
    for (const status of Object.keys(agent.lastMetrics?.zimbra?.accounts?.byStatus || {})) {
      statuses.add(normalizeStatus(status))
    }
  }
  return Array.from(statuses).sort()
})

const filteredRows = computed(() => accountRows.value.filter((row) => {
  const needle = search.value.toLowerCase().trim()
  const matchesSearch = !needle || `${row.email} ${row.displayName || ''} ${row.hostLabel} ${row.agent.hostname} ${row.agent.lastIp || ''}`.toLowerCase().includes(needle)
  const matchesHost = hostFilter.value === 'all' || row.agent.id === hostFilter.value
  const matchesStatus = statusFilter.value === 'all' || row.normalizedStatus === statusFilter.value
  const matchesIssue = issueFilter.value === 'all'
    || (issueFilter.value === 'quota' && row.issues.includes('quota'))
    || (issueFilter.value === 'inactive' && row.issues.includes('inactive'))
    || (issueFilter.value === 'status' && row.normalizedStatus !== 'active')
    || (issueFilter.value === 'warnings' && row.issues.length > 0)
  return matchesSearch && matchesHost && matchesStatus && matchesIssue
}))

const filteredHostSummaries = computed(() => zimbraHosts.value.filter((agent) => {
  if (hostFilter.value !== 'all' && agent.id !== hostFilter.value) return false
  const needle = search.value.toLowerCase().trim()
  if (needle && !`${agent.name || ''} ${agent.hostname} ${agent.lastIp || ''}`.toLowerCase().includes(needle)) return false
  const snapshot = agent.lastMetrics?.zimbra?.accounts
  if (statusFilter.value !== 'all' && statusCount(snapshot, statusFilter.value) < 1) return false
  if (issueFilter.value === 'quota') return !!snapshot?.quotaWarningCount
  if (issueFilter.value === 'inactive') return !!snapshot?.inactiveCount
  if (issueFilter.value === 'status') return statusCount(snapshot, 'locked') + statusCount(snapshot, 'closed') + statusCount(snapshot, 'maintenance') > 0
  if (issueFilter.value === 'warnings') return accountSummaryReviewCount(snapshot) > 0 || Object.keys(snapshot?.errors || {}).length > 0
  return true
}))

const totalAccounts = computed(() => accountHosts.value.reduce((sum, agent) => sum + accountTotal(agent.lastMetrics?.zimbra?.accounts), 0))
const reviewCount = computed(() => {
  if (accountRows.value.length) return accountRows.value.filter(row => row.issues.length > 0 || row.normalizedStatus !== 'active').length
  return accountHosts.value.reduce((sum, agent) => sum + accountSummaryReviewCount(agent.lastMetrics?.zimbra?.accounts), 0)
})
const partialAccountData = computed(() => accountHosts.value.some((agent) => {
  const accounts = agent.lastMetrics?.zimbra?.accounts
  return !!accounts?.truncated || Object.keys(accounts?.errors || {}).length > 0
}))

function accountEntries(snapshot?: ZimbraAccountSnapshot): ZimbraAccountHealth[] {
  return snapshot?.entries || snapshot?.accounts || []
}

function accountTotal(snapshot?: ZimbraAccountSnapshot) {
  return snapshot?.total ?? accountEntries(snapshot).length
}

function accountSummaryReviewCount(snapshot?: ZimbraAccountSnapshot) {
  if (!snapshot) return 0
  return statusCount(snapshot, 'locked')
    + statusCount(snapshot, 'closed')
    + statusCount(snapshot, 'maintenance')
    + (snapshot.quotaWarningCount || 0)
    + (snapshot.inactiveCount || 0)
}

function statusCount(snapshot: ZimbraAccountSnapshot | undefined, status: string) {
  if (!snapshot) return 0
  const direct = snapshot[status as keyof ZimbraAccountSnapshot]
  if (typeof direct === 'number') return direct
  const match = Object.entries(snapshot.byStatus || {}).find(([key]) => normalizeStatus(key) === status)
  return match ? match[1] : 0
}

function normalizeStatus(value?: string) {
  return (value || 'unknown').toLowerCase().trim().replace(/\s+/g, '_')
}

function normalizeQuotaPercent(account: ZimbraAccountHealth) {
  if (typeof account.quotaPercent === 'number' && Number.isFinite(account.quotaPercent)) return account.quotaPercent
  if (account.quotaLimitBytes && account.quotaLimitBytes > 0 && typeof account.quotaUsedBytes === 'number') {
    return Math.max(0, Math.min(100, (account.quotaUsedBytes / account.quotaLimitBytes) * 100))
  }
  return null
}

function accountIssues(account: ZimbraAccountHealth, status: string, quotaPercent: number | null) {
  const issues = new Set<string>()
  if (status !== 'active') issues.add('status')
  if (quotaPercent != null && quotaPercent >= 80) issues.add('quota')
  if ((account.warnings || []).includes('inactive')) issues.add('inactive')
  for (const warning of account.warnings || []) {
    if (warning) issues.add(warning)
  }
  return Array.from(issues)
}

function statusLabel(status?: string) {
  const normalized = normalizeStatus(status)
  return normalized === 'not_yet_active'
    ? 'Not yet active'
    : normalized.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function statusBadgeClass(status: string) {
  if (status === 'active') return 'badge-success'
  if (status === 'locked' || status === 'maintenance') return 'badge-warning'
  if (status === 'closed') return 'badge-error'
  return 'badge-ghost'
}

const number = (value: number) => new Intl.NumberFormat('en-US').format(value)
const date = formatAbsoluteTime
const bytes = (value?: number) => value == null || !Number.isFinite(value) ? 'Unavailable' : `${(value / 1024 ** 3).toFixed(1)} GiB`
</script>
