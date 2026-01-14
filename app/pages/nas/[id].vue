<template>
  <div class="animate-fade-in max-w-4xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <NuxtLink to="/nas" class="btn btn-ghost btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to NAS List
      </NuxtLink>
      <div class="flex gap-2">
        <NuxtLink :to="`/nas/${id}/edit`" class="btn btn-primary btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </NuxtLink>
        <button class="btn btn-error btn-sm" @click="confirmDelete">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete
        </button>
      </div>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="device" class="space-y-6">
      <!-- Header Card -->
      <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold">{{ device.name }}</h1>
            <div class="flex items-center gap-3 mt-2">
              <span v-if="device.type" class="badge badge-lg">{{ device.type }}</span>
              <span :class="['badge badge-lg', device.isActive ? 'badge-success' : 'badge-ghost']">
                {{ device.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Storage Info Card -->
      <div v-if="device.totalCapacityGB" class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
        <h2 class="text-xl font-bold mb-4">Storage Information</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="text-center p-4 bg-base-200/50 rounded-lg">
            <div class="text-3xl font-bold text-primary">{{ device.totalCapacityGB }}</div>
            <div class="text-sm text-base-content/60">Total GB</div>
          </div>
          <div class="text-center p-4 bg-base-200/50 rounded-lg">
            <div class="text-3xl font-bold text-warning">{{ device.usedCapacityGB || 0 }}</div>
            <div class="text-sm text-base-content/60">Used GB</div>
          </div>
          <div class="text-center p-4 bg-base-200/50 rounded-lg">
            <div class="text-3xl font-bold text-success">{{ freeCapacity }}</div>
            <div class="text-sm text-base-content/60">Free GB</div>
          </div>
        </div>
        <div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium">Storage Utilization</span>
            <span class="text-sm font-bold">{{ usagePercent.toFixed(1) }}%</span>
          </div>
          <progress 
            class="progress w-full h-4" 
            :class="progressColor"
            :value="usagePercent" 
            max="100"
          ></progress>
        </div>
      </div>

      <!-- Details Card -->
      <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
        <h2 class="text-xl font-bold mb-4">Device Details</h2>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-if="device.location">
            <dt class="text-sm text-base-content/60">Location</dt>
            <dd class="font-medium">{{ device.location }}</dd>
          </div>
          <div v-if="device.ipAddress">
            <dt class="text-sm text-base-content/60">IP Address</dt>
            <dd class="font-medium font-mono">{{ device.ipAddress }}</dd>
          </div>
          <div v-if="device.bayCount">
            <dt class="text-sm text-base-content/60">Number of Bays</dt>
            <dd class="font-medium">{{ device.bayCount }}</dd>
          </div>
          <div v-if="device.site">
            <dt class="text-sm text-base-content/60">Site</dt>
            <dd class="font-medium">{{ device.site.name }}</dd>
          </div>
          <div>
            <dt class="text-sm text-base-content/60">Created</dt>
            <dd class="font-medium">{{ formatDate(device.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-base-content/60">Last Updated</dt>
            <dd class="font-medium">{{ formatDate(device.updatedAt) }}</dd>
          </div>
        </dl>
        <div v-if="device.notes" class="mt-4 pt-4 border-t border-base-200">
          <dt class="text-sm text-base-content/60 mb-2">Notes</dt>
          <dd class="text-sm whitespace-pre-wrap">{{ device.notes }}</dd>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <dialog :class="['modal', showDeleteModal && 'modal-open']">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete NAS Device</h3>
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
const route = useRoute()
const id = route.params.id as string

// Fetch device
const { data: device, pending } = await useFetch(`/api/nas/${id}`)

// Delete modal
const showDeleteModal = ref(false)
const deleting = ref(false)

function confirmDelete() {
  showDeleteModal.value = true
}

async function deleteDevice() {
  deleting.value = true
  try {
    await $fetch(`/api/nas/${id}`, {
      method: 'DELETE',
    })
    await navigateTo('/nas')
  } catch (error) {
    console.error('Failed to delete NAS device:', error)
  } finally {
    deleting.value = false
  }
}

// Computed properties
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

// Helpers
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}
</script>
