<template>
  <div class="infra-panel overflow-hidden">
    <div class="px-5 py-4 border-b border-base-300">
      <h2 class="type-card-title">Host account snapshots</h2>
    </div>
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Host</th>
            <th>Snapshot</th>
            <th>Total</th>
            <th>Active</th>
            <th>Locked</th>
            <th>Closed</th>
            <th>Maintenance</th>
            <th>Quota warnings</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="agent in agents" :key="agent.id">
            <td>
              <NuxtLink :to="`/agents/${agent.id}`" class="text-primary hover:underline">{{ hostLabel(agent) }}</NuxtLink>
              <p class="text-xs text-base-content/60">{{ agent.hostname }}<span v-if="agent.lastIp"> &middot; {{ agent.lastIp }}</span></p>
            </td>
            <td>
              <span v-if="snapshot(agent)" class="badge badge-success">Reported</span>
              <span v-else class="badge badge-ghost">Unavailable</span>
              <p class="text-xs text-base-content/60 mt-1">{{ date(snapshot(agent)?.checkedAt || agent.lastMetrics?.zimbra?.checkedAt) }}</p>
            </td>
            <td>{{ accountTotal(snapshot(agent)).toLocaleString() }}</td>
            <td>{{ statusCount(snapshot(agent), 'active').toLocaleString() }}</td>
            <td>{{ statusCount(snapshot(agent), 'locked').toLocaleString() }}</td>
            <td>{{ statusCount(snapshot(agent), 'closed').toLocaleString() }}</td>
            <td>{{ statusCount(snapshot(agent), 'maintenance').toLocaleString() }}</td>
            <td>{{ (snapshot(agent)?.quotaWarningCount || 0).toLocaleString() }}</td>
          </tr>
          <tr v-if="!agents.length">
            <td colspan="8" class="text-center py-6 text-base-content/60">No hosts match your filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonitoringAgent, ZimbraAccountSnapshot } from '~/types/service-monitoring'

defineProps<{ agents: MonitoringAgent[] }>()

function snapshot(agent: MonitoringAgent) {
  return agent.lastMetrics?.zimbra?.accounts
}

function hostLabel(agent: MonitoringAgent) {
  return agent.name || agent.hostname
}

function accountTotal(snapshot?: ZimbraAccountSnapshot) {
  return snapshot?.total ?? snapshot?.entries?.length ?? snapshot?.accounts?.length ?? 0
}

function statusCount(snapshot: ZimbraAccountSnapshot | undefined, status: string) {
  if (!snapshot) return 0
  const direct = snapshot[status as keyof ZimbraAccountSnapshot]
  if (typeof direct === 'number') return direct
  const match = Object.entries(snapshot.byStatus || {}).find(([key]) => key.toLowerCase() === status)
  return match ? match[1] : 0
}

function date(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Unavailable'
}
</script>
