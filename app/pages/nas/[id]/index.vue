<template>
  <div class="animate-fade-in">
    <div v-if="pending" class="flex items-center justify-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else-if="device">
      <!-- Header -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4 min-w-0">
          <NuxtLink to="/nas" class="btn btn-ghost btn-circle shrink-0">
            <ArrowLeft class="w-5 h-5" :stroke-width="2" />
          </NuxtLink>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="type-headline truncate">{{ device.name }}</h1>
              <span v-if="device.type" class="badge">{{ device.type }}</span>
              <span class="badge badge-ghost font-mono">{{ device.model || 'Model unset' }}</span>
              <span :class="['badge', device.isActive ? 'badge-success' : 'badge-ghost']">
                {{ device.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <p v-if="device.lastCapturedAt" class="type-body-sm text-base-content/60 mt-1">
              Last captured {{ formatTimeAgo(device.lastCapturedAt) }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-outline gap-2"
            :disabled="capturing"
            @click="captureData"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': capturing }" :stroke-width="2" />
            {{ capturing ? 'Capturing...' : 'Refresh Data' }}
          </button>
          <NuxtLink :to="`/nas/${id}/edit`" class="btn btn-primary gap-2">
            <Pencil class="w-4 h-4" :stroke-width="2" />
            Edit
          </NuxtLink>
          <button class="btn btn-error gap-2" @click="confirmDelete">
            <Trash2 class="w-4 h-4" :stroke-width="2" />
            Delete
          </button>
        </div>
      </div>

      <div v-if="captureError" class="alert alert-error rounded-none mb-6">
        <AlertCircle class="w-5 h-5 shrink-0" :stroke-width="2" />
        <span>{{ captureError }}</span>
      </div>

      <div v-if="snapshot" class="alert rounded-none mb-6" :class="justCaptured ? 'alert-success' : 'alert-info'">
        <CheckCircle2 v-if="justCaptured" class="w-5 h-5 shrink-0" :stroke-width="2" />
        <HardDrive v-else class="w-5 h-5 shrink-0" :stroke-width="2" />
        <span>
          <template v-if="justCaptured">Capture complete —</template>
          <template v-else>Last capture —</template>
          {{ snapshot.volumes.length }} volume(s),
          {{ snapshot.disks.length }} disk(s)
          <template v-if="captureSummary">
            · {{ captureSummary.storageUsedGB }} / {{ captureSummary.storageTotalGB }} GB used
          </template>
        </span>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Main column -->
        <div class="xl:col-span-2 space-y-6">
          <div v-if="device.totalCapacityGB" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Storage Information</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div class="p-4 bg-base-200/50 rounded-none">
                <div class="text-3xl font-bold text-primary font-mono">{{ formatGB(device.totalCapacityGB) }}</div>
                <div class="text-sm text-base-content/60 mt-1">Total</div>
              </div>
              <div class="p-4 bg-base-200/50 rounded-none">
                <div class="text-3xl font-bold text-warning font-mono">{{ formatGB(device.usedCapacityGB) }}</div>
                <div class="text-sm text-base-content/60 mt-1">Used</div>
              </div>
              <div class="p-4 bg-base-200/50 rounded-none">
                <div class="text-3xl font-bold text-success font-mono">{{ formatGB(freeCapacity) }}</div>
                <div class="text-sm text-base-content/60 mt-1">Free</div>
              </div>
            </div>
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium">Storage Utilization</span>
                <span class="text-sm font-bold font-mono">{{ usagePercent.toFixed(1) }}%</span>
              </div>
              <progress
                class="progress w-full h-4"
                :class="progressColor"
                :value="usagePercent"
                max="100"
              ></progress>
            </div>
          </div>

          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Physical Disks</h2>

            <NasChassis
              v-if="diskBays.length || device.bayCount || device.model || device.type"
              class="mb-6"
              :bays="diskBays"
              :bay-count="effectiveBayCount"
              :model="device.model"
              :vendor="device.type"
              @select="selectedDiskBay = $event"
            />

            <div v-if="selectedDiskBay?.disk" class="mb-6 p-4 bg-base-200 border border-base-300 rounded-none">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-ink-muted">Selected bay</p>
                  <p class="font-medium">Slot {{ selectedDiskBay.slot }}</p>
                  <p class="text-sm mt-1">{{ selectedDiskBay.disk.model }}</p>
                  <p class="font-mono text-sm text-ink-muted mt-1">
                    {{ formatBytes(selectedDiskBay.disk.totalBytes) }}
                    · {{ selectedDiskBay.disk.health }}
                    <template v-if="selectedDiskBay.disk.temperature != null">
                      · {{ selectedDiskBay.disk.temperature }}°C
                    </template>
                  </p>
                </div>
                <button class="btn btn-ghost btn-sm" @click="selectedDiskBay = null">Close</button>
              </div>
            </div>

            <div v-if="snapshot?.disks?.length" class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr class="bg-base-200/50">
                    <th>Slot</th>
                    <th>Model</th>
                    <th>Capacity</th>
                    <th>Health</th>
                    <th>Temp</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="disk in snapshot.disks" :key="disk.slot + disk.model">
                    <td class="font-mono text-sm">{{ disk.slot }}</td>
                    <td>{{ disk.model }}</td>
                    <td class="font-mono text-sm">{{ formatBytes(disk.totalBytes) }}</td>
                    <td>
                      <span :class="['badge badge-sm', disk.health === 'healthy' ? 'badge-success' : 'badge-warning']">
                        {{ disk.health }}
                      </span>
                    </td>
                    <td class="font-mono text-sm">{{ disk.temperature != null ? `${disk.temperature}°C` : '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-base-content/60">No disks returned by the NAS API.</p>
          </div>

          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Volumes</h2>
            <div v-if="snapshot?.volumes?.length" class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr class="bg-base-200/50">
                    <th>Name</th>
                    <th>Total</th>
                    <th>Used</th>
                    <th>Free</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="vol in snapshot.volumes" :key="vol.name">
                    <td class="font-medium">{{ vol.name }}</td>
                    <td class="font-mono text-sm">{{ formatBytes(vol.totalBytes) }}</td>
                    <td class="font-mono text-sm">{{ formatBytes(vol.usedBytes) }}</td>
                    <td class="font-mono text-sm">{{ formatBytes(vol.freeBytes) }}</td>
                    <td>
                      <span :class="['badge badge-sm', vol.status === 'healthy' || vol.status === 'normal' ? 'badge-success' : 'badge-warning']">
                        {{ vol.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-base-content/60">No volumes returned by the NAS API.</p>
          </div>
        </div>

        <!-- Side column -->
        <div class="space-y-6">
          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Device Details</h2>
            <dl class="space-y-4">
              <div v-if="device.ipAddress">
                <dt class="text-sm text-base-content/60">IP Address</dt>
                <dd class="font-medium font-mono mt-1">{{ device.ipAddress }}</dd>
              </div>
              <div v-if="device.location">
                <dt class="text-sm text-base-content/60">Location</dt>
                <dd class="font-medium mt-1">{{ device.location }}</dd>
              </div>
              <div>
                <dt class="text-sm text-base-content/60">Vendor</dt>
                <dd class="font-medium mt-1">{{ device.type || '—' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-base-content/60">Model</dt>
                <dd class="font-medium font-mono mt-1">{{ device.model || '—' }}</dd>
              </div>
              <div v-if="device.bayCount">
                <dt class="text-sm text-base-content/60">Number of Bays</dt>
                <dd class="font-medium mt-1">{{ device.bayCount }}</dd>
              </div>
              <div v-if="device.site">
                <dt class="text-sm text-base-content/60">Site</dt>
                <dd class="font-medium mt-1">{{ device.site.name }}</dd>
              </div>
              <div>
                <dt class="text-sm text-base-content/60">Created</dt>
                <dd class="font-medium mt-1">{{ formatDate(device.createdAt) }}</dd>
              </div>
              <div>
                <dt class="text-sm text-base-content/60">Last Updated</dt>
                <dd class="font-medium mt-1">{{ formatDate(device.updatedAt) }}</dd>
              </div>
            </dl>
            <div v-if="device.notes" class="mt-4 pt-4 border-t border-base-200">
              <dt class="text-sm text-base-content/60 mb-2">Notes</dt>
              <dd class="text-sm whitespace-pre-wrap">{{ device.notes }}</dd>
            </div>
          </div>

          <div v-if="snapshot?.notes?.length" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Capture Notes</h2>
            <ul class="list-disc list-inside text-sm text-base-content/70 space-y-1">
              <li v-for="(note, i) in snapshot.notes" :key="i">{{ note }}</li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }" :open="showDeleteModal || undefined" @close="showDeleteModal = false">
      <div class="modal-box glass-modal rounded-none">
        <h3 class="type-card-title">Delete NAS Device</h3>
        <p class="py-4">
          Are you sure you want to delete <strong>{{ device?.name }}</strong>?
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" :disabled="deleting" @click="deleteDevice">
            <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
            Delete
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle2, HardDrive, Pencil, RefreshCw, Trash2 } from '@lucide/vue'

const route = useRoute()
const id = route.params.id as string

type NasSnapshot = {
  volumes: { name: string; totalBytes: number; usedBytes: number; freeBytes: number; status: string }[]
  disks: {
    slot: string
    model: string
    totalBytes: number
    health: string
    temperature: number | null
    kind?: 'hdd' | 'nvme'
  }[]
  notes: string[]
}

function summaryFromSnapshot(s: NasSnapshot) {
  const totalBytes = s.volumes.reduce((sum, v) => sum + (v.totalBytes || 0), 0)
  const usedBytes = s.volumes.reduce((sum, v) => sum + (v.usedBytes || 0), 0)
  return {
    storageTotalGB: totalBytes > 0 ? Math.round(totalBytes / 1_073_741_824 * 100) / 100 : 0,
    storageUsedGB: totalBytes > 0 ? Math.round(usedBytes / 1_073_741_824 * 100) / 100 : 0,
  }
}

const { data: device, pending } = await useFetch(`/api/nas/${id}`)

const capturing = ref(false)
const justCaptured = ref(false)
const snapshot = ref<NasSnapshot | null>(
  device.value?.lastSnapshot && typeof device.value.lastSnapshot === 'object'
    ? device.value.lastSnapshot as NasSnapshot
    : null,
)
const captureSummary = ref<{ storageTotalGB: number; storageUsedGB: number } | null>(
  snapshot.value ? summaryFromSnapshot(snapshot.value) : null,
)
const captureError = ref('')
const selectedDiskBay = ref<{
  slot: string | number
  status: string
  caption?: string
  disk?: any
} | null>(null)

function mapDiskStatus(health: string): 'healthy' | 'warning' | 'critical' | 'unknown' {
  const h = (health || '').toLowerCase().trim()
  if (!h || h === '-' || h === 'n/a' || h === 'none') return 'unknown'
  if (/healthy|normal|ok|good|pass|ready|fine|initialized|online|optimal|\b0\b/.test(h)) return 'healthy'
  if (/critical|fail|error|dead|crash|bad|fault|offline/.test(h)) return 'critical'
  if (/warn|degrad|hot|smart|caution|abnormal/.test(h)) return 'warning'
  return 'unknown'
}

function isNvmeDisk(disk: NasSnapshot['disks'][number]): boolean {
  const model = `${disk.model || ''}`.toLowerCase()
  if (/nvme|m\.?2|e10m20|pcie/i.test(`${model} ${disk.slot || ''}`)) return true
  if (disk.kind === 'hdd') return false
  // Stale QNAP captures set kind=nvme for HDD on slots 9–10 — trust model instead
  if (disk.kind === 'nvme') return !model || model === '-'
  return false
}

const diskBays = computed(() => {
  if (!snapshot.value?.disks?.length) return []
  return snapshot.value.disks.map((disk) => {
    let status = mapDiskStatus(disk.health)
    // Occupied bay with no SMART detail → show healthy (green) rather than unknown gray
    if (status === 'unknown' && disk.model && disk.model !== '-') {
      status = 'healthy'
    }
    return {
      slot: disk.slot,
      status,
      caption: disk.temperature != null ? `${disk.temperature}°C` : undefined,
      kind: isNvmeDisk(disk) ? 'nvme' as const : 'hdd' as const,
      disk,
    }
  })
})

/** Invalid bayCount (e.g. -3) must not win over model defaults */
const effectiveBayCount = computed(() => {
  const n = Number(device.value?.bayCount)
  if (Number.isFinite(n) && n > 0) return n
  return 8
})

async function captureData() {
  capturing.value = true
  captureError.value = ''
  justCaptured.value = false
  try {
    const result = await $fetch<any>(`/api/nas/${id}/capture`, { method: 'POST' })
    snapshot.value = result.snapshot || { volumes: [], disks: [], notes: [] }
    captureSummary.value = result.summary || summaryFromSnapshot(snapshot.value!)
    justCaptured.value = true
    if (result.updated) {
      device.value = result.updated
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    captureError.value = err.data?.statusMessage || err.message || 'Failed to capture NAS data'
  } finally {
    capturing.value = false
  }
}

const showDeleteModal = ref(false)
const deleting = ref(false)

function confirmDelete() {
  showDeleteModal.value = true
}

async function deleteDevice() {
  deleting.value = true
  try {
    await $fetch(`/api/nas/${id}`, { method: 'DELETE' })
    await navigateTo('/nas')
  } catch (error) {
    console.error('Failed to delete NAS device:', error)
  } finally {
    deleting.value = false
  }
}

const freeCapacity = computed(() => {
  if (!device.value?.totalCapacityGB) return 0
  const used = device.value.usedCapacityGB || 0
  return device.value.totalCapacityGB - used
})

const usagePercent = computed(() => {
  if (!device.value?.totalCapacityGB || device.value.totalCapacityGB === 0) return 0
  const used = device.value.usedCapacityGB || 0
  return (used / device.value.totalCapacityGB) * 100
})

const progressColor = computed(() => {
  const percent = usagePercent.value
  if (percent >= 90) return 'progress-error'
  if (percent >= 75) return 'progress-warning'
  return 'progress-success'
})

function formatGB(value: number | null | undefined): string {
  if (value == null) return '0'
  if (value >= 1000) return `${(value / 1000).toFixed(1)} TB`
  return `${Math.round(value)} GB`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_099_511_627_776) return `${(bytes / 1_099_511_627_776).toFixed(1)} TB`
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

const { format: formatTimeAgo } = useFormatTimeAgo()
const formatDate = formatAbsoluteTime
</script>
