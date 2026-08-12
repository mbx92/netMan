<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="type-headline">MikroTik Routers</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Configure MikroTik routers for ARP/DHCP discovery
        </p>
      </div>
      <NuxtLink to="/settings/mikrotik/create" class="btn btn-primary">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Router
      </NuxtLink>
    </div>

    <!-- MikroTik Devices Table -->
    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
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
              <td class="font-medium">
                <NuxtLink :to="`/settings/mikrotik/${device.id}`" class="link link-hover text-primary">
                  {{ device.name }}
                </NuxtLink>
              </td>
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
                  <NuxtLink
                    :to="`/settings/mikrotik/${device.id}`"
                    class="btn btn-ghost btn-xs tooltip"
                    data-tip="View Detail"
                  >
                    <Eye class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <NuxtLink 
                    :to="`/settings/mikrotik/${device.id}/edit`" 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Edit Router"
                  >
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Test Connection"
                    :disabled="testing === device.id"
                    @click="testConnection(device)"
                  >
                    <span v-if="testing === device.id" class="loading loading-spinner loading-xs"></span>
                    <CheckCircle2 v-else class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <button 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Sync Now"
                    :disabled="syncing === device.id"
                    @click="syncDevice(device)"
                  >
                    <span v-if="syncing === device.id" class="loading loading-spinner loading-xs"></span>
                    <RefreshCw v-else class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(device)">
                    <Trash2 class="w-4 h-4" :stroke-width="2" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }" :open="showDeleteModal || undefined" @close="showDeleteModal = false">
      <div class="modal-box glass-modal rounded-none">
        <h3 class="type-card-title">Delete Router</h3>
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
    <dialog class="modal" :class="{ 'modal-open': showFeedbackModal }" :open="showFeedbackModal || undefined" @close="showFeedbackModal = false">
      <div class="modal-box glass-modal rounded-none !max-w-[514px]">
        <div class="flex items-start gap-3">
          <div :class="['w-10 h-10 rounded-none flex items-center justify-center flex-shrink-0', feedbackType === 'success' ? 'bg-success/20 text-success' : feedbackType === 'error' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning']">
            <CheckCircle2 v-if="feedbackType === 'success'" class="w-6 h-6" :stroke-width="2" />
            <XCircle v-else-if="feedbackType === 'error'" class="w-6 h-6" :stroke-width="2" />
            <AlertCircle v-else class="w-6 h-6" :stroke-width="2" />
          </div>
          <div>
            <h3 class="type-card-title">{{ feedbackTitle }}</h3>
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
import { AlertCircle, CheckCircle2, Eye, Pencil, Plus, RefreshCw, Trash2, XCircle } from '@lucide/vue'

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

const { format: formatTimeAgo } = useFormatTimeAgo()
</script>
