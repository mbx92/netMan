<template>
  <div class="animate-fade-in">
    <div class="mb-6">
      <NuxtLink to="/proxmox" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Proxmox Nodes
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="!node" class="infra-panel p-6">
      <h1 class="type-card-title mb-2">Node not found</h1>
      <p class="type-body-sm text-base-content/60 mb-6">This node may have been deleted.</p>
      <NuxtLink to="/proxmox" class="btn btn-primary">Back to Proxmox Nodes</NuxtLink>
    </div>

    <div v-else>
      <!-- Header -->
      <div class="infra-panel p-6 mb-6">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <p class="page-kicker mb-2">Proxmox Node</p>
            <h1 class="type-card-title">{{ node.name }}</h1>
            <p class="type-body-sm text-base-content/60 mt-1">
              {{ node.host }}:{{ node.port }}
              <span v-if="node.site">· {{ node.site.name }}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-outline gap-2" :disabled="syncing" @click="syncNode">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': syncing }" :stroke-width="2" />
              Sync Now
            </button>
            <NuxtLink :to="`/proxmox/${node.id}/edit`" class="btn btn-primary gap-2">
              <Pencil class="w-4 h-4" :stroke-width="2" />
              Edit
            </NuxtLink>
          </div>
        </div>
        <div class="mt-6 space-y-2 type-body-sm">
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">HOST</span>
            <span class="font-medium">{{ node.host }}:{{ node.port }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">SYNC</span>
            <span>{{ node.lastSync ? formatDate(node.lastSync) : 'Never' }}</span>
          </div>
        </div>
      </div>

      <!-- Nodes -->
      <div v-if="snapshot && snapshot.nodes && snapshot.nodes.length" class="infra-panel p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="type-card-title">Cluster Nodes</h2>
          <span class="type-mono text-base-content/50">{{ snapshot.nodes.length }} NODES</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in snapshot.nodes" :key="n.name">
                <td class="font-mono">{{ n.name }}</td>
                <td>
                  <span :class="['badge', n.status === 'online' ? 'badge-success' : 'badge-error']">
                    {{ n.status }}
                  </span>
                </td>
                <td class="text-sm">{{ n.cpu || '-' }}</td>
                <td class="font-mono text-sm">{{ fmtUptime(n.uptime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Virtual Guests -->
      <div v-if="snapshot && snapshot.virtualGuests && snapshot.virtualGuests.length" class="infra-panel overflow-hidden mb-6">
        <div class="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 class="type-card-title">Virtual Guests</h2>
          <span class="type-mono text-base-content/50">{{ snapshot.virtualGuests.length }} VM / LXC</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>VMID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Node</th>
                <th>IP</th>
                <th>MAC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in snapshot.virtualGuests" :key="g.vmid">
                <td class="font-mono">{{ g.vmid }}</td>
                <td class="font-medium">{{ g.name }}</td>
                <td>
                  <span :class="['badge', g.type === 'qemu' ? 'badge-primary' : 'badge-secondary']">
                    {{ g.type === 'qemu' ? 'VM' : 'LXC' }}
                  </span>
                </td>
                <td>
                  <span :class="['badge', g.status === 'running' ? 'badge-success' : 'badge-ghost']">
                    {{ g.status }}
                  </span>
                </td>
                <td class="text-sm">{{ g.node }}</td>
                <td class="font-mono text-sm">{{ g.ipAddress || '-' }}</td>
                <td class="font-mono text-sm">{{ g.macAddress || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Storage -->
      <div v-if="snapshot && snapshot.storages && snapshot.storages.length" class="infra-panel overflow-hidden mb-6">
        <div class="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 class="type-card-title">Storage</h2>
          <span class="type-mono text-base-content/50">{{ snapshot.storages.length }} POOLS</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Total</th>
                <th>Used</th>
                <th>Node</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in snapshot.storages" :key="`${s.node}-${s.storage}`">
                <td class="font-medium">{{ s.storage }}</td>
                <td><span class="badge badge-outline">{{ s.type }}</span></td>
                <td class="font-mono text-sm">{{ fmtBytes(s.total) }}</td>
                <td class="font-mono text-sm">{{ fmtBytes(s.used) }}</td>
                <td class="text-sm">{{ s.node }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Network -->
      <div v-if="snapshot && snapshot.network && snapshot.network.length" class="infra-panel overflow-hidden mb-6">
        <div class="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 class="type-card-title">Network</h2>
          <span class="type-mono text-base-content/50">{{ snapshot.network.length }} INTERFACES</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Interface</th>
                <th>Type</th>
                <th>Address</th>
                <th>Node</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in snapshot.network" :key="`${n.node}-${n.iface}`">
                <td class="font-mono">{{ n.iface }}</td>
                <td><span class="badge badge-outline">{{ n.type }}</span></td>
                <td class="font-mono text-sm">{{ n.address || '-' }}</td>
                <td class="text-sm">{{ n.node }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Backups -->
      <div v-if="snapshot && snapshot.backups && snapshot.backups.length" class="infra-panel overflow-hidden">
        <div class="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 class="type-card-title">Backups</h2>
          <span class="type-mono text-base-content/50">{{ snapshot.backups.length }} BACKUPS</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>VMID</th>
                <th>Size</th>
                <th>Format</th>
                <th>Storage</th>
                <th>Node</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in snapshot.backups" :key="b.volid">
                <td class="font-mono">{{ b.vmid }}</td>
                <td class="font-mono text-sm">{{ fmtBytes(b.size) }}</td>
                <td><span class="badge badge-outline">{{ b.format }}</span></td>
                <td class="text-sm">{{ b.storage }}</td>
                <td class="text-sm">{{ b.node }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Pencil, RefreshCw } from '@lucide/vue'

interface ProxmoxNodeStatus {
  name: string
  status: string
  cpu?: string
  maxCpu?: number
  mem?: number
  uptime?: number
}

interface ProxmoxGuest {
  vmid: number
  name: string
  type: 'qemu' | 'lxc'
  status: string
  node: string
  ipAddress?: string
  macAddress?: string
  networks?: { name: string; ip?: string; mac?: string }[]
}

interface ProxmoxStorageInfo {
  storage: string
  type: string
  total: number
  used: number
  node: string
}

interface ProxmoxNetworkInfo {
  iface: string
  type: string
  address?: string
  node: string
}

interface ProxmoxBackupInfo {
  volid: string
  size: number
  vmid: number
  format: string
  storage: string
  node: string
}

interface ProxmoxSnapshot {
  nodes: ProxmoxNodeStatus[]
  virtualGuests: ProxmoxGuest[]
  storages: ProxmoxStorageInfo[]
  network: ProxmoxNetworkInfo[]
  backups: ProxmoxBackupInfo[]
}

interface ProxmoxNodeDetail {
  id: string
  name: string
  host: string
  port: number
  isActive: boolean
  lastSync: string | null
  lastSnapshot: ProxmoxSnapshot | null
  siteId: string | null
  site: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const id = route.params.id as string

const { data: node, refresh, pending } = await useFetch<ProxmoxNodeDetail>(`/api/proxmox/${id}`)
const syncing = ref(false)

const snapshot = computed(() => node.value?.lastSnapshot || null)

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

function fmtUptime(seconds: number | undefined): string {
  if (!seconds) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

async function syncNode() {
  syncing.value = true
  try {
    await $fetch(`/api/proxmox/${id}/sync`, { method: 'POST' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Sync failed: ' + (err.data?.statusMessage || err.message || 'Unknown error'))
  } finally {
    syncing.value = false
  }
}
</script>
