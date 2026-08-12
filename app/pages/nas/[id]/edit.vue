<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/nas" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to NAS List
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="device" class="bg-base-100 border border-base-300 rounded-none p-6">
      <h1 class="type-card-title mb-6">Edit NAS Device</h1>

      <form @submit.prevent="saveDevice">
        <div class="space-y-4">
          <!-- Name -->
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="form.name" type="text" class="input input-bordered" required />
          </div>

          <!-- Vendor -->
          <div class="form-control">
            <label class="label"><span class="label-text">Vendor</span></label>
            <select v-model="form.type" class="select select-bordered" @change="onVendorChange">
              <option value="">Select vendor...</option>
              <option value="QNAP">QNAP</option>
              <option value="Synology">Synology</option>
              <option value="TrueNAS">TrueNAS</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <!-- Model (chassis SVG) -->
          <div class="form-control">
            <label class="label"><span class="label-text">Model</span></label>
            <select v-model="form.model" class="select select-bordered">
              <option value="">Auto-detect on capture</option>
              <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
            <p class="text-xs text-base-content/50 mt-1">
              Pilih model untuk chassis SVG (RS1221+ / TS-873A). Bisa dikosongkan — capture dari API akan mengisi otomatis.
            </p>
          </div>

          <!-- Location -->
          <div class="form-control">
            <label class="label"><span class="label-text">Location</span></label>
            <input v-model="form.location" type="text" class="input input-bordered" />
          </div>

          <!-- IP Address & Credentials -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div class="form-control">
              <label class="label"><span class="label-text">IP Address</span></label>
              <input v-model="form.ipAddress" type="text" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">API Username</span></label>
              <input v-model="form.username" type="text" class="input input-bordered" placeholder="admin" />
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">API Password</span></label>
            <input v-model="form.password" type="password" class="input input-bordered" placeholder="Leave blank to keep current" />
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
import { ArrowLeft } from '@lucide/vue'
import { modelsForVendor, resolveNasModel } from '~/utils/nas-models'

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
  model: device.value?.model || '',
  location: device.value?.location || '',
  ipAddress: device.value?.ipAddress || '',
  username: device.value?.username || '',
  password: '',
  totalCapacityGB: device.value?.totalCapacityGB || undefined,
  usedCapacityGB: device.value?.usedCapacityGB || undefined,
  bayCount: device.value?.bayCount || undefined,
  siteId: device.value?.siteId || '',
  notes: device.value?.notes || '',
  isActive: device.value?.isActive !== false,
})

const modelOptions = computed(() => modelsForVendor(form.type || null))

function onVendorChange() {
  if (form.model && !modelOptions.value.some(m => m.id === form.model)) {
    form.model = ''
  }
}

watch(() => form.model, (id) => {
  const known = resolveNasModel(id)
  if (known) {
    if (!form.type) form.type = known.vendor
    if (!form.bayCount) form.bayCount = known.bayCount
  }
})

// Watch for device data changes
watch(device, (newDevice) => {
  if (newDevice) {
    form.name = newDevice.name
    form.type = newDevice.type || ''
    form.model = newDevice.model || ''
    form.location = newDevice.location || ''
    form.ipAddress = newDevice.ipAddress || ''
    form.username = newDevice.username || ''
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
    const body: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      model: form.model || null,
      location: form.location,
      ipAddress: form.ipAddress,
      username: form.username || undefined,
      totalCapacityGB: form.totalCapacityGB,
      usedCapacityGB: form.usedCapacityGB,
      bayCount: form.bayCount,
      notes: form.notes,
      siteId: form.siteId || undefined,
      isActive: form.isActive,
    }
    // Only send password when user typed a new one
    if (form.password) body.password = form.password

    await $fetch(`/api/nas/${id}`, {
      method: 'PUT',
      body,
    })
    await navigateTo('/nas')
  } catch (error) {
    console.error('Failed to update NAS device:', error)
  } finally {
    saving.value = false
  }
}
</script>
