<template>
  <div class="animate-fade-in max-w-4xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <NuxtLink to="/nas" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to NAS List
      </NuxtLink>
      <div class="flex gap-2">
        <NuxtLink :to="`/nas/${id}/edit`" class="btn btn-primary btn-sm">
          <Pencil class="w-4 h-4" :stroke-width="2" />
          Edit
        </NuxtLink>
        <button class="btn btn-error btn-sm" @click="confirmDelete">
          <Trash2 class="w-4 h-4" :stroke-width="2" />
          Delete
        </button>
      </div>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="device" class="space-y-6">
      <!-- Header Card -->
      <div class="bg-base-100 border border-base-300 rounded-none p-6">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="type-headline">{{ device.name }}</h1>
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
      <div v-if="device.totalCapacityGB" class="bg-base-100 border border-base-300 rounded-none p-6">
        <h2 class="type-card-title mb-4">Storage Information</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="text-center p-4 bg-base-200/50 rounded-none">
            <div class="text-3xl font-bold text-primary">{{ device.totalCapacityGB }}</div>
            <div class="text-sm text-base-content/60">Total GB</div>
          </div>
          <div class="text-center p-4 bg-base-200/50 rounded-none">
            <div class="text-3xl font-bold text-warning">{{ device.usedCapacityGB || 0 }}</div>
            <div class="text-sm text-base-content/60">Used GB</div>
          </div>
          <div class="text-center p-4 bg-base-200/50 rounded-none">
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
      <div class="bg-base-100 border border-base-300 rounded-none p-6">
        <h2 class="type-card-title mb-4">Device Details</h2>
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
import { ArrowLeft, Pencil, Trash2 } from '@lucide/vue'

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

const formatDate = formatAbsoluteTime
</script>
