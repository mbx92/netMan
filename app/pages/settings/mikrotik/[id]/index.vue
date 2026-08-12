<template>
  <div class="animate-fade-in">
    <div v-if="pending" class="flex items-center justify-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else-if="device">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4 min-w-0">
          <NuxtLink to="/settings/mikrotik" class="btn btn-ghost btn-circle shrink-0">
            <ArrowLeft class="w-5 h-5" :stroke-width="2" />
          </NuxtLink>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="type-headline truncate">{{ device.name }}</h1>
              <span :class="['badge', device.apiVersion === 'v7' ? 'badge-info' : 'badge-warning']">
                ROS {{ device.apiVersion === 'v7' ? '7+' : '6.x' }}
              </span>
              <span :class="['badge', device.isActive ? 'badge-success' : 'badge-ghost']">
                {{ device.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <p class="type-body-sm text-base-content/60 mt-1 font-mono">
              {{ device.host }}:{{ device.port }}
              <template v-if="device.lastSync">
                · Last sync {{ formatTimeAgo(device.lastSync) }}
              </template>
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-outline gap-2" :disabled="capturing" @click="capturePorts">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': capturing }" :stroke-width="2" />
            {{ capturing ? 'Refreshing...' : 'Refresh Ports' }}
          </button>
          <button class="btn btn-outline gap-2" :disabled="testing" @click="testConnection">
            <span v-if="testing" class="loading loading-spinner loading-sm"></span>
            <CheckCircle2 v-else class="w-4 h-4" :stroke-width="2" />
            Test
          </button>
          <NuxtLink :to="`/settings/mikrotik/${id}/edit`" class="btn btn-primary gap-2">
            <Pencil class="w-4 h-4" :stroke-width="2" />
            Edit
          </NuxtLink>
          <button class="btn btn-error gap-2" :disabled="deleting" @click="deleteDevice">
            <Trash2 class="w-4 h-4" :stroke-width="2" />
            Delete
          </button>
        </div>
      </div>

      <div v-if="captureError" class="alert alert-error rounded-none mb-6">
        <AlertCircle class="w-5 h-5 shrink-0" :stroke-width="2" />
        <span>{{ captureError }}</span>
      </div>

      <div v-if="feedback" class="alert rounded-none mb-6" :class="feedback.type === 'success' ? 'alert-success' : feedback.type === 'error' ? 'alert-error' : 'alert-info'">
        <span>{{ feedback.message }}</span>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 space-y-6">
          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Port Map</h2>
            <MikrotikPortGrid :ports="ports" @select="selectedPort = $event" />

            <div v-if="selectedPort" class="mt-6 p-4 bg-base-200 border border-base-300 rounded-none">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-ink-muted">Selected port</p>
                  <p class="font-medium font-mono">{{ selectedPort.name }}</p>
                  <p class="text-sm mt-1 capitalize">
                    {{ selectedPort.kind }}
                    · {{ selectedPort.running ? 'link up' : 'link down' }}
                    <template v-if="selectedPort.disabled"> · disabled</template>
                  </p>
                  <p v-if="selectedPort.mac" class="font-mono text-sm text-ink-muted mt-1">
                    {{ selectedPort.mac }}
                  </p>
                </div>
                <button class="btn btn-ghost btn-sm" @click="selectedPort = null">Close</button>
              </div>
            </div>
          </div>

          <div v-if="snapshot?.vlans?.length" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">VLANs</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr class="bg-base-200/50">
                    <th>Name</th>
                    <th>VLAN ID</th>
                    <th>Interface</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="vlan in snapshot.vlans" :key="vlan.name + vlan.vlanId">
                    <td>{{ vlan.name }}</td>
                    <td class="font-mono">{{ vlan.vlanId }}</td>
                    <td class="font-mono text-sm">{{ vlan.interface || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Router Details</h2>
            <dl class="space-y-4">
              <div>
                <dt class="text-sm text-base-content/60">Host</dt>
                <dd class="font-medium font-mono mt-1">{{ device.host }}:{{ device.port }}</dd>
              </div>
              <div>
                <dt class="text-sm text-base-content/60">Username</dt>
                <dd class="font-medium mt-1">{{ device.username }}</dd>
              </div>
              <div v-if="snapshot?.identity">
                <dt class="text-sm text-base-content/60">Identity</dt>
                <dd class="font-medium mt-1">{{ snapshot.identity }}</dd>
              </div>
              <div v-if="snapshot?.model">
                <dt class="text-sm text-base-content/60">Model</dt>
                <dd class="font-medium mt-1">{{ snapshot.model }}</dd>
              </div>
              <div v-if="snapshot?.version">
                <dt class="text-sm text-base-content/60">RouterOS</dt>
                <dd class="font-medium mt-1">{{ snapshot.version }}</dd>
              </div>
              <div v-if="snapshot?.mac">
                <dt class="text-sm text-base-content/60">MAC</dt>
                <dd class="font-medium font-mono mt-1">{{ snapshot.mac }}</dd>
              </div>
              <div v-if="device.site">
                <dt class="text-sm text-base-content/60">Site</dt>
                <dd class="font-medium mt-1">{{ device.site.name }}</dd>
              </div>
              <div>
                <dt class="text-sm text-base-content/60">Created</dt>
                <dd class="font-medium mt-1">{{ formatDate(device.createdAt) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="portSummary" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Port Summary</h2>
            <div class="grid grid-cols-3 gap-3">
              <div class="p-3 bg-base-200/50 rounded-none text-center">
                <div class="text-2xl font-mono font-bold">{{ portSummary.ethernet }}</div>
                <div class="text-xs text-base-content/60">Ethernet</div>
              </div>
              <div class="p-3 bg-base-200/50 rounded-none text-center">
                <div class="text-2xl font-mono font-bold text-primary">{{ portSummary.sfp }}</div>
                <div class="text-xs text-base-content/60">SFP</div>
              </div>
              <div class="p-3 bg-base-200/50 rounded-none text-center">
                <div class="text-2xl font-mono font-bold text-success">{{ portSummary.running }}</div>
                <div class="text-xs text-base-content/60">Link up</div>
              </div>
            </div>
          </div>

          <div v-if="snapshot?.bridges?.length" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Bridges</h2>
            <ul class="space-y-2 text-sm">
              <li v-for="b in snapshot.bridges" :key="b.name" class="flex justify-between gap-2">
                <span>{{ b.name }}</span>
                <span class="font-mono text-ink-muted">{{ b.mac || '-' }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle2, Pencil, RefreshCw, Trash2 } from '@lucide/vue'
import MikrotikPortGrid from '~/components/mikrotik/PortGrid.vue'
import type { MikroTikPortView } from '~/components/mikrotik/PortGrid.vue'

const route = useRoute()
const id = route.params.id as string

type MikroTikSnapshot = {
  identity?: string | null
  model?: string | null
  version?: string | null
  mac?: string | null
  portCount?: number
  ports: MikroTikPortView[]
  bridges: { name: string; mac?: string }[]
  vlans: { name: string; vlanId: number; interface?: string }[]
  notes?: string[]
}

const { data: device, pending } = await useFetch(`/api/mikrotik/${id}`)

const capturing = ref(false)
const testing = ref(false)
const captureError = ref('')
const feedback = ref<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
const selectedPort = ref<MikroTikPortView | null>(null)
const deleting = ref(false)

const snapshot = ref<MikroTikSnapshot | null>(
  device.value?.lastSnapshot && typeof device.value.lastSnapshot === 'object'
    ? device.value.lastSnapshot as MikroTikSnapshot
    : null,
)

const ports = computed(() => snapshot.value?.ports || [])

const portSummary = computed(() => {
  if (!ports.value.length) return null
  return {
    ethernet: ports.value.filter(p => p.kind === 'ethernet').length,
    sfp: ports.value.filter(p => p.kind === 'sfp').length,
    running: ports.value.filter(p => p.running && !p.disabled).length,
  }
})

async function capturePorts() {
  capturing.value = true
  captureError.value = ''
  feedback.value = null
  try {
    const result = await $fetch<any>(`/api/mikrotik/${id}/capture`, { method: 'POST' })
    snapshot.value = result.snapshot
    if (result.updated) device.value = result.updated
    feedback.value = {
      type: 'success',
      message: `Captured ${result.summary?.ethernet || 0} ethernet and ${result.summary?.sfp || 0} SFP port(s)`,
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    captureError.value = err.data?.statusMessage || err.message || 'Failed to capture ports'
  } finally {
    capturing.value = false
  }
}

async function testConnection() {
  testing.value = true
  feedback.value = null
  try {
    const result = await $fetch<any>(`/api/mikrotik/${id}/test`, { method: 'POST' })
    feedback.value = {
      type: result.success ? 'success' : 'error',
      message: result.message || (result.success ? 'Connection OK' : 'Connection failed'),
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    feedback.value = {
      type: 'error',
      message: err.data?.statusMessage || err.message || 'Test failed',
    }
  } finally {
    testing.value = false
  }
}

async function deleteDevice() {
  const ok = await confirmDialog({
    title: 'Delete Router',
    message: `Are you sure you want to delete ${device.value?.name || 'this router'}?`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return

  deleting.value = true
  try {
    await $fetch(`/api/mikrotik/${id}`, { method: 'DELETE' })
    await navigateTo('/settings/mikrotik')
  } catch (error) {
    console.error('Failed to delete MikroTik device:', error)
  } finally {
    deleting.value = false
  }
}

const { format: formatTimeAgo } = useFormatTimeAgo()
const formatDate = formatAbsoluteTime
</script>
