<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="type-headline">NAS Storage</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Manage your network attached storage devices
        </p>
      </div>
      <NuxtLink to="/nas/create" class="btn btn-primary">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add NAS
      </NuxtLink>
    </div>

    <!-- NAS Devices Table -->
    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Name</th>
              <th>Vendor</th>
              <th>Model</th>
              <th>Location</th>
              <th>Storage</th>
              <th>Utilization</th>
              <th>Bays</th>
              <th>Site</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending" class="h-32">
              <td colspan="9" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!devices?.length" class="h-32">
              <td colspan="9" class="text-center text-base-content/60">
                No NAS devices found. Click "Add NAS" to create one.
              </td>
            </tr>
            <tr v-for="device in devices" :key="device.id" class="hover:bg-base-200/50">
              <td>
                <NuxtLink :to="`/nas/${device.id}`" class="font-medium hover:text-primary">
                  {{ device.name }}
                </NuxtLink>
              </td>
              <td>
                <span v-if="device.type" class="badge badge-sm badge-ghost">{{ device.type }}</span>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>
                <span v-if="device.model" class="font-mono text-sm">{{ device.model }}</span>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>{{ device.location || '-' }}</td>
              <td>
                <div v-if="device.totalCapacityGB" class="text-sm">
                  <span class="font-medium">{{ device.usedCapacityGB || 0 }} / {{ device.totalCapacityGB }} GB</span>
                </div>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>
                <div v-if="device.totalCapacityGB && device.totalCapacityGB > 0" class="flex items-center gap-2">
                  <progress 
                    class="progress w-20" 
                    :class="getProgressColor(getUsagePercent(device))"
                    :value="getUsagePercent(device)" 
                    max="100"
                  ></progress>
                  <span class="text-sm font-medium">{{ getUsagePercent(device).toFixed(1) }}%</span>
                </div>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>
                <span v-if="device.bayCount" class="text-sm">{{ device.bayCount }}</span>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>{{ device.site?.name || '-' }}</td>
              <td>
                <div class="flex items-center gap-1">
                  <NuxtLink :to="`/nas/${device.id}/edit`" class="btn btn-ghost btn-xs">
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
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
        <h3 class="type-card-title">Delete NAS Device</h3>
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
  </div>
</template>

<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'

interface Site {
  id: string
  name: string
}

interface NASDevice {
  id: string
  name: string
  type: string | null
  model: string | null
  location: string | null
  ipAddress: string | null
  totalCapacityGB: number | null
  usedCapacityGB: number | null
  bayCount: number | null
  site: Site | null
}

// Fetch devices
const { data: deviceData, pending, refresh } = await useFetch('/api/nas')
const devices = computed(() => deviceData.value?.devices as NASDevice[] || [])

// Delete modal
const showDeleteModal = ref(false)
const deleting = ref(false)
const deviceToDelete = ref<NASDevice | null>(null)

function confirmDelete(device: NASDevice) {
  deviceToDelete.value = device
  showDeleteModal.value = true
}

async function deleteDevice() {
  if (!deviceToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/nas/${deviceToDelete.value.id}`, {
      method: 'DELETE',
    })
    showDeleteModal.value = false
    deviceToDelete.value = null
    refresh()
  } catch (error) {
    console.error('Failed to delete NAS device:', error)
  } finally {
    deleting.value = false
  }
}

// Helpers
function getUsagePercent(device: NASDevice): number {
  if (!device.totalCapacityGB || device.totalCapacityGB === 0) return 0
  const used = device.usedCapacityGB || 0
  return (used / device.totalCapacityGB) * 100
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return 'progress-error'
  if (percent >= 75) return 'progress-warning'
  return 'progress-success'
}
</script>
