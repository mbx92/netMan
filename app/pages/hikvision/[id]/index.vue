<template>
  <div class="animate-fade-in">
    <div class="mb-6">
      <NuxtLink to="/hikvision" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Hikvision Devices
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="!device" class="infra-panel p-6">
      <h1 class="type-card-title mb-2">Device not found</h1>
      <p class="type-body-sm text-base-content/60 mb-6">This device may have been deleted.</p>
      <NuxtLink to="/hikvision" class="btn btn-primary">Back to Hikvision Devices</NuxtLink>
    </div>

    <div v-else>
      <!-- Device Header -->
      <div class="infra-panel p-6 mb-6">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <p class="page-kicker mb-2">Hikvision {{ device.deviceType }}</p>
            <h1 class="type-card-title">{{ device.name }}</h1>
            <p class="type-body-sm text-base-content/60 mt-1">
              {{ device.model || 'Unknown model' }}
              <span v-if="device.serialNumber">· SN {{ device.serialNumber }}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-outline gap-2" :disabled="syncing" @click="syncDevice">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': syncing }" :stroke-width="2" />
              Sync Now
            </button>
            <NuxtLink :to="`/hikvision/${device.id}/edit`" class="btn btn-primary gap-2">
              <Pencil class="w-4 h-4" :stroke-width="2" />
              Edit
            </NuxtLink>
          </div>
        </div>

        <div class="mt-6 space-y-2 type-body-sm">
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">HOST</span>
            <span class="font-medium">{{ device.host }}:{{ device.port }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">MAC</span>
            <span>{{ device.macAddress || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">FW</span>
            <span>{{ device.firmware || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">SITE</span>
            <span>{{ device.site?.name || 'Not set' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-16">SYNC</span>
            <span>{{ device.lastSync ? formatDate(device.lastSync) : 'Never' }}</span>
          </div>
        </div>
      </div>

      <!-- Storage -->
      <div v-if="storage" class="infra-panel p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="type-card-title">Storage</h2>
          <span class="type-mono text-base-content/50">{{ storage.diskCount || 0 }} DISKS</span>
        </div>

        <div class="flex items-baseline gap-8 mb-4">
          <div>
            <span class="type-mono text-base-content/50">Total: </span>
            <span class="font-medium">{{ fmtGb(storage.totalCapacity) }}</span>
          </div>
          <div>
            <span class="type-mono text-base-content/50">Used: </span>
            <span class="font-medium text-warning">{{ fmtGb(storage.usedCapacity) }}</span>
          </div>
          <div>
            <span class="type-mono text-base-content/50">Free: </span>
            <span class="font-medium text-success">{{ fmtGb(storage.freeCapacity) }}</span>
          </div>
        </div>

        <div v-if="storage.totalCapacity && storage.usedCapacity" class="mb-6">
          <div class="flex justify-between text-xs mb-1">
            <span class="type-mono text-base-content/60">Usage {{ usagePercent }}%</span>
            <span class="type-mono text-base-content/60">{{ fmtGb(storage.usedCapacity) }} / {{ fmtGb(storage.totalCapacity) }}</span>
          </div>
          <progress class="progress w-full" :value="storage.usedCapacity" :max="storage.totalCapacity"></progress>
        </div>

        <div v-if="storage.disks?.length" class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Capacity</th>
                <th>Free</th>
                <th>Status</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disk in storage.disks" :key="disk.id">
                <td class="font-mono">{{ disk.id }}</td>
                <td class="font-medium">{{ disk.name || '-' }}</td>
                <td class="font-mono text-sm">{{ fmtGb(disk.capacity) }}</td>
                <td class="font-mono text-sm">{{ fmtGb(disk.freeSpace) }}</td>
                <td>
                  <span :class="['badge', disk.status === 'ok' ? 'badge-success' : disk.status === 'error' ? 'badge-error' : 'badge-ghost']">
                    {{ disk.status || '-' }}
                  </span>
                </td>
                <td class="text-sm">{{ disk.type || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Network -->
      <div v-if="snapshot && snapshot.network && hasNetData" class="infra-panel p-6 mb-6">
        <h2 class="type-card-title mb-4">Network</h2>
        <div class="space-y-2 type-body-sm">
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">IP</span>
            <span class="font-mono">{{ snapshot.network.ipAddress || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">Subnet</span>
            <span class="font-mono">{{ snapshot.network.subnetMask || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">Gateway</span>
            <span class="font-mono">{{ snapshot.network.defaultGateway || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">DNS 1</span>
            <span class="font-mono">{{ snapshot.network.dnsPrimary || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">DNS 2</span>
            <span class="font-mono">{{ snapshot.network.dnsSecondary || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">Speed</span>
            <span>{{ snapshot.network.speed || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">Mode</span>
            <span>{{ snapshot.network.mode || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- Time / NTP -->
      <div v-if="snapshot && snapshot.time && hasTimeData" class="infra-panel p-6 mb-6">
        <h2 class="type-card-title mb-4">Time & NTP</h2>
        <div class="space-y-2 type-body-sm">
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">Local</span>
            <span>{{ snapshot.time.localTime || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">TZ</span>
            <span>{{ snapshot.time.timeZone || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">Mode</span>
            <span>{{ snapshot.time.timeMode || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">NTP 1</span>
            <span class="font-mono">{{ snapshot.time.ntpServer1 || '-' }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="type-mono text-base-content/50 w-24">NTP 2</span>
            <span class="font-mono">{{ snapshot.time.ntpServer2 || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- RTSP -->
      <div v-if="snapshot && snapshot.rtsp && snapshot.rtsp.port" class="infra-panel p-6 mb-6">
        <h2 class="type-card-title mb-4">RTSP</h2>
        <div class="flex items-center gap-8 type-body-sm">
          <div>
            <span class="type-mono text-base-content/50">Port: </span>
            <span class="font-mono">{{ snapshot.rtsp.port || 554 }}</span>
          </div>
          <div>
            <span class="type-mono text-base-content/50">Auth: </span>
            <span>{{ snapshot.rtsp.authentication || 'digest/basic' }}</span>
          </div>
          <div>
            <span class="type-mono text-base-content/50">Enabled: </span>
            <span :class="['badge', snapshot.rtsp.enabled !== false ? 'badge-success' : 'badge-error']">
              {{ snapshot.rtsp.enabled !== false ? 'Yes' : 'No' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Channels -->
      <div class="infra-panel overflow-hidden">
        <div class="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 class="type-card-title">Channels</h2>
          <span class="type-mono text-base-content/50">{{ device.channels.length }} CHANNELS</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>IP Address</th>
                <th>MAC</th>
                <th>Protocol</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!device.channels.length">
                <td colspan="6" class="text-center py-8 text-base-content/60">
                  No channels synced yet. Click "Sync Now" to fetch channels from ISAPI.
                </td>
              </tr>
              <tr v-for="ch in device.channels" :key="ch.id">
                <td class="font-mono">{{ ch.channelIndex }}</td>
                <td class="font-medium">{{ ch.name }}</td>
                <td class="font-mono text-sm">{{ ch.ipAddress || '-' }}</td>
                <td class="font-mono text-sm">{{ ch.macAddress || '-' }}</td>
                <td>
                  <span class="badge badge-outline">{{ ch.protocol || '-' }}</span>
                </td>
                <td>
                  <span :class="['badge', ch.status === 'ONLINE' ? 'badge-success' : ch.status === 'OFFLINE' ? 'badge-error' : 'badge-ghost']">
                    {{ ch.status }}
                  </span>
                </td>
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

interface HikvisionChannel {
  id: string
  channelIndex: number
  name: string | null
  ipAddress: string | null
  managePort: number
  protocol: string | null
  macAddress: string | null
  status: string
  model: string | null
  firmware: string | null
  rtspUrl?: string | null
}

interface HikvisionDisk {
  id?: number
  name?: string
  capacity?: number
  freeSpace?: number
  status?: string
  property?: string
  type?: string
}

interface HikvisionStorage {
  totalCapacity?: number
  freeCapacity?: number
  usedCapacity?: number
  diskCount?: number
  disks?: HikvisionDisk[]
}

interface HikvisionNetwork {
  ipAddress?: string
  subnetMask?: string
  defaultGateway?: string
  dnsPrimary?: string
  dnsSecondary?: string
  macAddress?: string
  mtu?: number
  mode?: string
  nicName?: string
  nicType?: string
  speed?: string
}

interface HikvisionTime {
  timeMode?: string
  localTime?: string
  timeZone?: string
  ntpServer1?: string
  ntpServer2?: string
}

interface HikvisionRtsp {
  enabled?: boolean
  port?: number
  authentication?: string
}

interface HikvisionSnapshot {
  info?: Record<string, unknown>
  network?: HikvisionNetwork
  time?: HikvisionTime
  rtsp?: HikvisionRtsp
  storage?: HikvisionStorage
  channels?: unknown[]
  events?: unknown
}

interface HikvisionDevice {
  id: string
  name: string
  host: string
  port: number
  protocol: string
  deviceType: string
  model: string | null
  serialNumber: string | null
  macAddress: string | null
  firmware: string | null
  isActive: boolean
  lastSync: string | null
  lastSnapshot: HikvisionSnapshot | null
  siteId: string | null
  site: { id: string; name: string } | null
  channels: HikvisionChannel[]
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const id = route.params.id as string

const { data: device, refresh, pending } = await useFetch<HikvisionDevice>(`/api/hikvision/${id}`)
const syncing = ref(false)

const snapshot = computed(() => device.value?.lastSnapshot || null)

const storage = computed<HikvisionStorage | null>(() => {
  return snapshot.value?.storage || null
})

const hasNetData = computed(() => {
  const n = snapshot.value?.network
  return !!(n && (n.ipAddress || n.subnetMask || n.defaultGateway || n.macAddress || n.dnsPrimary))
})

const hasTimeData = computed(() => {
  const t = snapshot.value?.time
  return !!(t && (t.localTime || t.timeZone || t.timeMode || t.ntpServer1))
})

const usagePercent = computed(() => {
  if (!storage.value?.totalCapacity || !storage.value?.usedCapacity) return 0
  return Math.round((storage.value.usedCapacity / storage.value.totalCapacity) * 100)
})

function fmtGb(gb: number | undefined): string {
  if (gb === undefined || gb === null) return '-'
  if (gb >= 1024) return (gb / 1024).toFixed(2) + ' TB'
  return gb.toFixed(1) + ' GB'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function syncDevice() {
  syncing.value = true
  try {
    const result = await $fetch<{ message?: string; ipam?: { created: number; updated: number; skipped: number } }>(
      `/api/hikvision/${id}/sync`,
      { method: 'POST' },
    )
    await refresh()
    if (result?.ipam) {
      await alertDialog({
        title: 'Sync Complete',
        message: result.message || `IPAM: +${result.ipam.created} created, ${result.ipam.updated} named`,
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    await alertDialog({
      title: 'Sync Failed',
      message: err.data?.statusMessage || err.message || 'Unknown error',
      variant: 'danger',
    })
  } finally {
    syncing.value = false
  }
}
</script>
