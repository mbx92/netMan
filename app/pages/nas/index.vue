<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold">NAS Storage</h1>
        <p class="text-base-content/60 mt-1">
          Manage your network attached storage devices
        </p>
      </div>
      <NuxtLink to="/nas/create" class="btn btn-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add NAS
      </NuxtLink>
    </div>

    <!-- NAS Devices Table -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Name</th>
              <th>Type</th>
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
              <td colspan="8" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!devices?.length" class="h-32">
              <td colspan="8" class="text-center text-base-content/60">
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
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </NuxtLink>
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

    <!-- Delete Confirmation Modal -->
    <dialog :class="['modal', showDeleteModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg">Delete NAS Device</h3>
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
interface Site {
  id: string
  name: string
}

interface NASDevice {
  id: string
  name: string
  type: string | null
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
