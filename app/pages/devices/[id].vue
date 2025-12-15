<template>
  <div class="animate-fade-in">
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>{{ error.statusMessage || 'Device not found' }}</span>
      <NuxtLink to="/devices" class="btn btn-ghost btn-sm">Back to Devices</NuxtLink>
    </div>

    <!-- Device Content -->
    <template v-else-if="device">
      <!-- Header -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <NuxtLink to="/devices" class="btn btn-ghost btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </NuxtLink>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-bold">{{ device.name }}</h1>
              <span :class="['badge', getStatusBadgeClass(device.status)]">
                {{ device.status }}
              </span>
            </div>
            <p class="text-base-content/60 mt-1">{{ getTypeLabel(device.type) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button 
            v-if="device.wakeable && device.mac" 
            class="btn btn-warning"
            @click="sendWoL(device.mac)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            Wake Device
          </button>
          <button class="btn btn-outline" @click="editMode = true">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Info Card -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Device Information -->
          <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Device Information</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="text-sm text-base-content/60">IP Address</label>
                <div class="font-mono text-lg mt-1">{{ device.ip || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">MAC Address</label>
                <div class="font-mono text-lg mt-1">{{ formatMac(device.mac) }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Hostname</label>
                <div class="text-lg mt-1">{{ device.hostname || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Location</label>
                <div class="text-lg mt-1">{{ device.location || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Owner</label>
                <div class="text-lg mt-1">{{ device.owner || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Wake-on-LAN</label>
                <div class="mt-1">
                  <span :class="['badge', device.wakeable ? 'badge-success' : 'badge-ghost']">
                    {{ device.wakeable ? 'Supported' : 'Not Supported' }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="device.notes" class="mt-6 pt-6 border-t border-base-200">
              <label class="text-sm text-base-content/60">Notes</label>
              <p class="mt-1 whitespace-pre-wrap">{{ device.notes }}</p>
            </div>
          </div>

          <!-- Network Ports (if applicable) -->
          <div v-if="device.ports?.length" class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Network Ports</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr class="border-base-200">
                    <th>Port</th>
                    <th>Status</th>
                    <th>VLAN</th>
                    <th>Speed</th>
                    <th>MAC Learned</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="port in device.ports" :key="port.id" class="border-base-200">
                    <td class="font-mono">{{ port.portName }}</td>
                    <td>
                      <span :class="['badge badge-sm', getPortStatusClass(port.status)]">
                        {{ port.status }}
                      </span>
                    </td>
                    <td>{{ port.vlan || '-' }}</td>
                    <td>{{ port.speed || '-' }}</td>
                    <td class="font-mono text-xs">
                      {{ port.macLearned?.length || 0 }} addresses
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Status Card -->
          <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Status</h2>
            <div class="flex items-center gap-3 mb-4">
              <div :class="['w-4 h-4 rounded-full', getStatusDotClass(device.status)]"></div>
              <span class="text-2xl font-bold">{{ device.status }}</span>
            </div>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-base-content/60">Last Seen</span>
                <span>{{ formatDateTime(device.lastSeen) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Created</span>
                <span>{{ formatDateTime(device.createdAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Updated</span>
                <span>{{ formatDateTime(device.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Recent Sessions -->
          <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Recent Sessions</h2>
            <div v-if="!device.sessions?.length" class="text-base-content/60 text-sm">
              No recent sessions
            </div>
            <div v-else class="space-y-3">
              <div v-for="session in device.sessions" :key="session.id" class="flex items-start gap-3 text-sm">
                <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span class="text-xs font-semibold text-primary">{{ session.protocol.charAt(0) }}</span>
                </div>
                <div>
                  <div class="font-medium">{{ session.protocol }}</div>
                  <div class="text-base-content/60">
                    {{ session.user }} • {{ formatTimeAgo(session.startedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit Modal -->
    <dialog :class="['modal', editMode && 'modal-open']">
      <div class="modal-box max-w-lg glass-modal">
        <h3 class="font-bold text-lg mb-4">Edit Device</h3>
        <form @submit.prevent="saveDevice">
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Name</span></label>
              <input v-model="editData.name" type="text" class="input input-bordered w-full" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Status</span></label>
              <select v-model="editData.status" class="select select-bordered w-full">
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="UNKNOWN">Unknown</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">IP Address</span></label>
                <input v-model="editData.ip" type="text" class="input input-bordered w-full" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">MAC Address</span></label>
                <input v-model="editData.mac" type="text" class="input input-bordered w-full" />
              </div>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Location</span></label>
              <input v-model="editData.location" type="text" class="input input-bordered w-full" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Owner</span></label>
              <input v-model="editData.owner" type="text" class="input input-bordered w-full" />
            </div>
            <div class="form-control">
              <label class="cursor-pointer label justify-start gap-3">
                <input v-model="editData.wakeable" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text">Supports Wake-on-LAN</span>
              </label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Notes</span></label>
              <textarea v-model="editData.notes" class="textarea textarea-bordered w-full" rows="3"></textarea>
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="editMode = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              Save Changes
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="editMode = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
interface Port {
  id: string
  portName: string
  status: string
  vlan: string | null
  speed: string | null
  macLearned: string[]
}

interface Session {
  id: string
  user: string
  protocol: string
  startedAt: string
}

interface Device {
  id: string
  name: string
  type: string
  ip: string | null
  mac: string | null
  hostname: string | null
  location: string | null
  status: string
  lastSeen: string | null
  owner: string | null
  notes: string | null
  wakeable: boolean
  createdAt: string
  updatedAt: string
  ports: Port[]
  sessions: Session[]
}

const route = useRoute()
const deviceId = route.params.id as string

// Fetch device
const { data: device, pending, error, refresh } = await useFetch<Device>(`/api/devices/${deviceId}`)

// Edit mode
const editMode = ref(false)
const saving = ref(false)
const editData = reactive({
  name: '',
  status: '',
  ip: '',
  mac: '',
  location: '',
  owner: '',
  wakeable: false,
  notes: '',
})

// Initialize edit data when device loads
watch(device, (d) => {
  if (d) {
    editData.name = d.name
    editData.status = d.status
    editData.ip = d.ip || ''
    editData.mac = d.mac || ''
    editData.location = d.location || ''
    editData.owner = d.owner || ''
    editData.wakeable = d.wakeable
    editData.notes = d.notes || ''
  }
}, { immediate: true })

async function saveDevice() {
  saving.value = true
  try {
    await $fetch(`/api/devices/${deviceId}`, {
      method: 'PUT',
      body: editData,
    })
    editMode.value = false
    refresh()
  } catch (e) {
    alert('Failed to save changes')
  } finally {
    saving.value = false
  }
}

// Wake on LAN
async function sendWoL(mac: string) {
  try {
    await $fetch(`/api/wol/${mac}`, { method: 'POST' })
    alert('Wake-on-LAN packet sent!')
  } catch (e) {
    alert('Failed to send Wake-on-LAN packet')
  }
}

// Display helpers
function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'badge-success',
    OFFLINE: 'badge-error',
    UNKNOWN: 'badge-warning',
    MAINTENANCE: 'badge-info',
  }
  return classes[status] || ''
}

function getStatusDotClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'bg-success pulse-dot',
    OFFLINE: 'bg-error',
    UNKNOWN: 'bg-warning',
    MAINTENANCE: 'bg-info',
  }
  return classes[status] || 'bg-base-300'
}

function getPortStatusClass(status: string): string {
  const classes: Record<string, string> = {
    UP: 'badge-success',
    DOWN: 'badge-error',
    DISABLED: 'badge-ghost',
  }
  return classes[status] || ''
}

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

function formatMac(mac: string | null): string {
  if (!mac) return '-'
  return mac.toUpperCase().match(/.{1,2}/g)?.join(':') || mac
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
