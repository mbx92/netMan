<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold">MikroTik Routers</h1>
        <p class="text-base-content/60 mt-1">
          Configure MikroTik routers for ARP/DHCP discovery
        </p>
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Router
      </button>
    </div>

    <!-- MikroTik Devices Table -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Status</th>
              <th>Name</th>
              <th>Host</th>
              <th>API Version</th>
              <th>Site</th>
              <th>Last Sync</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending" class="h-32">
              <td colspan="7" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!devices?.length" class="h-32">
              <td colspan="7" class="text-center text-base-content/60">
                No MikroTik routers configured
              </td>
            </tr>
            <tr v-for="device in devices" :key="device.id" class="hover:bg-base-200/50">
              <td>
                <span :class="['badge badge-sm', device.isActive ? 'badge-success' : 'badge-ghost']">
                  {{ device.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="font-medium">{{ device.name }}</td>
              <td class="font-mono text-sm">{{ device.host }}:{{ device.port }}</td>
              <td>
                <span :class="['badge badge-sm', device.apiVersion === 'v7' ? 'badge-info' : 'badge-warning']">
                  ROS {{ device.apiVersion === 'v7' ? '7+' : '6.x' }}
                </span>
              </td>
              <td>{{ device.site?.name || '-' }}</td>
              <td class="text-sm text-base-content/60">{{ formatTimeAgo(device.lastSync) }}</td>
              <td>
                <div class="flex items-center gap-1">
                  <button 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Test Connection"
                    :disabled="testing === device.id"
                    @click="testConnection(device)"
                  >
                    <span v-if="testing === device.id" class="loading loading-spinner loading-xs"></span>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </button>
                  <button 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Sync Now"
                    :disabled="syncing === device.id"
                    @click="syncDevice(device)"
                  >
                    <span v-if="syncing === device.id" class="loading loading-spinner loading-xs"></span>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(device)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Router Modal -->
    <dialog :class="['modal', showAddModal && 'modal-open']">
      <div class="modal-box max-w-lg glass-modal">
        <h3 class="font-bold text-lg mb-4">Add MikroTik Router</h3>
        <form @submit.prevent="addDevice">
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Name *</span></label>
              <input v-model="deviceForm.name" type="text" class="input input-bordered w-full" placeholder="e.g., Core Router Gedung A" required />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Host *</span></label>
                <input v-model="deviceForm.host" type="text" class="input input-bordered w-full" placeholder="10.5.50.1" required />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Port</span></label>
                <input v-model.number="deviceForm.port" type="number" class="input input-bordered w-full" :placeholder="deviceForm.apiVersion === 'v7' ? '443' : '8728'" />
              </div>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">RouterOS Version *</span></label>
              <div class="flex gap-4">
                <label class="cursor-pointer label justify-start gap-2">
                  <input v-model="deviceForm.apiVersion" type="radio" value="v6" class="radio radio-primary" />
                  <span class="label-text">ROS 6.x (API)</span>
                </label>
                <label class="cursor-pointer label justify-start gap-2">
                  <input v-model="deviceForm.apiVersion" type="radio" value="v7" class="radio radio-primary" />
                  <span class="label-text">ROS 7+ (REST)</span>
                </label>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Username *</span></label>
                <input v-model="deviceForm.username" type="text" class="input input-bordered w-full" placeholder="admin" required />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Password *</span></label>
                <input v-model="deviceForm.password" type="password" class="input input-bordered w-full" required />
              </div>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Site</span></label>
              <select v-model="deviceForm.siteId" class="select select-bordered w-full">
                <option value="">No Site</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="cursor-pointer label justify-start gap-3">
                <input v-model="deviceForm.testConnection" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text">Test connection before saving</span>
              </label>
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="showAddModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              Add Router
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showAddModal = false">close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog :class="['modal', showDeleteModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg">Delete Router</h3>
        <p class="py-4">
          Are you sure you want to delete <strong>{{ deviceToDelete?.name }}</strong>?
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" :disabled="deleting" @click="deleteDevice">
            <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDeleteModal = false">close</button>
      </form>
    </dialog>

    <!-- Feedback Modal -->
    <dialog :class="['modal', showFeedbackModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <div class="flex items-start gap-3">
          <div :class="['w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', feedbackType === 'success' ? 'bg-success/20 text-success' : feedbackType === 'error' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning']">
            <svg v-if="feedbackType === 'success'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <svg v-else-if="feedbackType === 'error'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <h3 class="font-bold text-lg">{{ feedbackTitle }}</h3>
            <p class="py-2 text-base-content/80">{{ feedbackMessage }}</p>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="showFeedbackModal = false">OK</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showFeedbackModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
interface Site {
  id: string
  name: string
}

interface MikrotikDevice {
  id: string
  name: string
  host: string
  port: number
  username: string
  apiVersion: string
  isActive: boolean
  lastSync: string | null
  siteId: string | null
  site: Site | null
}

// Fetch devices
const { data: deviceData, pending, refresh } = await useFetch('/api/mikrotik')
const devices = computed(() => deviceData.value?.devices as MikrotikDevice[] || [])

// Fetch sites for dropdown
const { data: siteData } = await useFetch('/api/sites')
const sites = computed(() => siteData.value?.sites as Site[] || [])

// Add modal
const showAddModal = ref(false)
const saving = ref(false)
const deviceForm = reactive({
  name: '',
  host: '',
  port: undefined as number | undefined,
  username: '',
  password: '',
  apiVersion: 'v6' as 'v6' | 'v7',
  siteId: '',
  testConnection: true,
})

// Feedback modal
const showFeedbackModal = ref(false)
const feedbackType = ref<'success' | 'error' | 'warning'>('success')
const feedbackTitle = ref('')
const feedbackMessage = ref('')

function showFeedback(type: 'success' | 'error' | 'warning', title: string, message: string) {
  feedbackType.value = type
  feedbackTitle.value = title
  feedbackMessage.value = message
  showFeedbackModal.value = true
}

function openAddModal() {
  deviceForm.name = ''
  deviceForm.host = ''
  deviceForm.port = undefined
  deviceForm.username = ''
  deviceForm.password = ''
  deviceForm.apiVersion = 'v6'
  deviceForm.siteId = ''
  deviceForm.testConnection = true
  showAddModal.value = true
}

async function addDevice() {
  saving.value = true
  try {
    await $fetch('/api/mikrotik', {
      method: 'POST',
      body: {
        ...deviceForm,
        siteId: deviceForm.siteId || undefined,
      },
    })
    showAddModal.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Failed to Add Router', err.data?.statusMessage || 'An error occurred while adding the router')
  } finally {
    saving.value = false
  }
}

// Test connection
const testing = ref<string | null>(null)
async function testConnection(device: MikrotikDevice) {
  testing.value = device.id
  try {
    const result = await $fetch<{ success: boolean; message: string; identity?: string }>(`/api/mikrotik/${device.id}/test`, {
      method: 'POST',
    })
    showFeedback(result.success ? 'success' : 'error', result.success ? 'Connection Successful' : 'Connection Failed', result.message)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Connection Failed', err.data?.statusMessage || 'Connection test failed')
  } finally {
    testing.value = null
  }
}

// Sync device
const syncing = ref<string | null>(null)
async function syncDevice(device: MikrotikDevice) {
  syncing.value = device.id
  try {
    const result = await $fetch<{ success: boolean; message: string; devices: number }>(`/api/mikrotik/${device.id}/sync`, {
      method: 'POST',
    })
    showFeedback('success', 'Sync Complete', result.message)
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Sync Failed', err.data?.statusMessage || 'Failed to sync data from router')
  } finally {
    syncing.value = null
  }
}

// Delete modal
const showDeleteModal = ref(false)
const deleting = ref(false)
const deviceToDelete = ref<MikrotikDevice | null>(null)

function confirmDelete(device: MikrotikDevice) {
  deviceToDelete.value = device
  showDeleteModal.value = true
}

async function deleteDevice() {
  if (!deviceToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/mikrotik/${deviceToDelete.value.id}`, {
      method: 'DELETE',
    })
    showDeleteModal.value = false
    deviceToDelete.value = null
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Failed to Delete', err.data?.statusMessage || 'An error occurred while deleting the router')
  } finally {
    deleting.value = false
  }
}

// Helpers
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
