<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/nas" class="btn btn-ghost btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to NAS List
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="device" class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
      <h1 class="text-2xl font-bold mb-6">Edit NAS Device</h1>

      <form @submit.prevent="saveDevice">
        <div class="space-y-4">
          <!-- Name -->
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="form.name" type="text" class="input input-bordered" required />
          </div>

          <!-- Type & Location -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Type</span></label>
              <select v-model="form.type" class="select select-bordered">
                <option value="">Select type...</option>
                <option value="QNAP">QNAP</option>
                <option value="Synology">Synology</option>
                <option value="TrueNAS">TrueNAS</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Location</span></label>
              <input v-model="form.location" type="text" class="input input-bordered" />
            </div>
          </div>

          <!-- IP Address -->
          <div class="form-control">
            <label class="label"><span class="label-text">IP Address</span></label>
            <input v-model="form.ipAddress" type="text" class="input input-bordered" />
          </div>

          <!-- Storage Capacity -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Total Capacity (GB)</span></label>
              <input v-model.number="form.totalCapacityGB" type="number" step="0.01" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Used Capacity (GB)</span></label>
              <input v-model.number="form.usedCapacityGB" type="number" step="0.01" class="input input-bordered" />
            </div>
          </div>

          <!-- Bay Count & Site -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Number of Bays</span></label>
              <input v-model.number="form.bayCount" type="number" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Site</span></label>
              <select v-model="form.siteId" class="select select-bordered">
                <option value="">No Site</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
              </select>
            </div>
          </div>

          <!-- Notes -->
          <div class="form-control">
            <label class="label"><span class="label-text">Notes</span></label>
            <textarea v-model="form.notes" class="textarea textarea-bordered h-24"></textarea>
          </div>

          <!-- Active Status -->
          <div class="form-control">
            <label class="cursor-pointer label justify-start gap-3">
              <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text">Active</span>
            </label>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/nas" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Update NAS Device
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Site {
  id: string
  name: string
}

const route = useRoute()
const id = route.params.id as string

// Fetch device data
const { data: device, pending } = await useFetch(`/api/nas/${id}`)

// Fetch sites
const { data: siteData } = await useFetch('/api/sites')
const sites = computed(() => siteData.value?.sites as Site[] || [])

// Form state
const form = reactive({
  name: device.value?.name || '',
  type: device.value?.type || '',
  location: device.value?.location || '',
  ipAddress: device.value?.ipAddress || '',
  totalCapacityGB: device.value?.totalCapacityGB || undefined,
  usedCapacityGB: device.value?.usedCapacityGB || undefined,
  bayCount: device.value?.bayCount || undefined,
  siteId: device.value?.siteId || '',
  notes: device.value?.notes || '',
  isActive: device.value?.isActive !== false,
})

// Watch for device data changes
watch(device, (newDevice) => {
  if (newDevice) {
    form.name = newDevice.name
    form.type = newDevice.type || ''
    form.location = newDevice.location || ''
    form.ipAddress = newDevice.ipAddress || ''
    form.totalCapacityGB = newDevice.totalCapacityGB || undefined
    form.usedCapacityGB = newDevice.usedCapacityGB || undefined
    form.bayCount = newDevice.bayCount || undefined
    form.siteId = newDevice.siteId || ''
    form.notes = newDevice.notes || ''
    form.isActive = newDevice.isActive !== false
  }
})

const saving = ref(false)

async function saveDevice() {
  saving.value = true
  try {
    await $fetch(`/api/nas/${id}`, {
      method: 'PUT',
      body: {
        ...form,
        siteId: form.siteId || undefined,
      },
    })
    await navigateTo('/nas')
  } catch (error) {
    console.error('Failed to update NAS device:', error)
  } finally {
    saving.value = false
  }
}
</script>
