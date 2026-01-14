<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/nas" class="btn btn-ghost btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to NAS List
      </NuxtLink>
    </div>

    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
      <h1 class="text-2xl font-bold mb-6">Add NAS Device</h1>

      <form @submit.prevent="saveDevice">
        <div class="space-y-4">
          <!-- Name -->
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="form.name" type="text" class="input input-bordered w-full" placeholder="e.g., Storage NAS 1" required />
          </div>

          <!-- Type & Location -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Type</span></label>
              <select v-model="form.type" class="select select-bordered w-full">
                <option value="">Select type...</option>
                <option value="QNAP">QNAP</option>
                <option value="Synology">Synology</option>
                <option value="TrueNAS">TrueNAS</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Location</span></label>
              <input v-model="form.location" type="text" class="input input-bordered w-full" placeholder="e.g., Server Room A" />
            </div>
          </div>

          <!-- IP Address -->
          <div class="form-control">
            <label class="label"><span class="label-text">IP Address</span></label>
            <input v-model="form.ipAddress" type="text" class="input input-bordered w-full" placeholder="e.g., 192.168.1.100" />
          </div>

          <!-- Storage Capacity -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  location: '',
  ipAddress: '',
  totalCapacityGB: undefined as number | undefined,
  usedCapacityGB: undefined as number | undefined,
  bayCount: undefined as number | undefined,
  siteId: '',
  notes: '',
})

const saving = ref(false)

async function saveDevice() {
  saving.value = true
  try {
    await $fetch('/api/nas', {
      method: 'POST',
      body: {
        ...form,
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
