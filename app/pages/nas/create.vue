<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/nas" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to NAS List
      </NuxtLink>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none p-6">
      <h1 class="type-card-title mb-6">Add NAS Device</h1>

      <form @submit.prevent="saveDevice">
        <div class="space-y-4">
          <!-- Name -->
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="form.name" type="text" class="input input-bordered w-full" placeholder="e.g., Storage NAS 1" required />
          </div>

          <!-- Vendor -->
          <div class="form-control">
            <label class="label"><span class="label-text">Vendor</span></label>
            <select v-model="form.type" class="select select-bordered w-full" @change="onVendorChange">
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
            <select v-model="form.model" class="select select-bordered w-full">
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
            <input v-model="form.location" type="text" class="input input-bordered w-full" placeholder="e.g., Server Room A" />
          </div>

          <!-- IP Address & Credentials -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div class="form-control">
              <label class="label"><span class="label-text">IP Address</span></label>
              <input v-model="form.ipAddress" type="text" class="input input-bordered w-full" placeholder="e.g., 192.168.1.100" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">API Username</span></label>
              <input v-model="form.username" type="text" class="input input-bordered w-full" placeholder="admin" />
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">API Password</span></label>
            <input v-model="form.password" type="password" class="input input-bordered w-full" placeholder="NAS admin password" />
          </div>

          <!-- Storage Capacity -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div class="form-control">
              <label class="label"><span class="label-text">Total Capacity (GB)</span></label>
              <input v-model.number="form.totalCapacityGB" type="number" step="0.01" class="input input-bordered w-full" placeholder="e.g., 10000" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Used Capacity (GB)</span></label>
              <input v-model.number="form.usedCapacityGB" type="number" step="0.01" class="input input-bordered w-full" placeholder="e.g., 2500" />
            </div>
          </div>

          <!-- Bay Count & Site -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div class="form-control">
              <label class="label"><span class="label-text">Number of Bays</span></label>
              <input v-model.number="form.bayCount" type="number" class="input input-bordered w-full" placeholder="e.g., 8" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Site</span></label>
              <select v-model="form.siteId" class="select select-bordered w-full">
                <option value="">No Site</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
              </select>
            </div>
          </div>

          <!-- Notes -->
          <div class="form-control">
            <label class="label"><span class="label-text">Notes</span></label>
            <textarea v-model="form.notes" class="textarea textarea-bordered h-24 w-full" placeholder="Additional information..."></textarea>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/nas" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Save NAS Device
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

// Fetch sites
const { data: siteData } = await useFetch('/api/sites')
const sites = computed(() => siteData.value?.sites as Site[] || [])

// Form state
const form = reactive({
  name: '',
  type: '',
  model: '',
  location: '',
  ipAddress: '',
  username: '',
  password: '',
  totalCapacityGB: undefined as number | undefined,
  usedCapacityGB: undefined as number | undefined,
  bayCount: undefined as number | undefined,
  siteId: '',
  notes: '',
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

const saving = ref(false)

async function saveDevice() {
  saving.value = true
  try {
    await $fetch('/api/nas', {
      method: 'POST',
      body: {
        ...form,
        model: form.model || undefined,
        siteId: form.siteId || undefined,
      },
    })
    await navigateTo('/nas')
  } catch (error) {
    console.error('Failed to save NAS device:', error)
  } finally {
    saving.value = false
  }
}
</script>
