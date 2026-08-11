<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/ipam" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to IPAM
      </NuxtLink>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">IPAM</p>
      <h1 class="type-card-title mb-6">Add IP Range</h1>

      <form @submit.prevent="saveRange">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="rangeForm.name" type="text" class="input input-bordered w-full" placeholder="e.g., Office Network" required />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Network (CIDR) *</span></label>
            <input v-model="rangeForm.network" type="text" class="input input-bordered w-full font-mono" placeholder="e.g., 192.168.1.0/24" required />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Gateway</span></label>
              <input v-model="rangeForm.gateway" type="text" class="input input-bordered w-full font-mono" placeholder="e.g., 192.168.1.1" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">VLAN</span></label>
              <input v-model="rangeForm.vlan" type="text" class="input input-bordered w-full" placeholder="e.g., 100" />
            </div>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Site</span></label>
            <select v-model="rangeForm.siteId" class="select select-bordered w-full">
              <option value="">No Site</option>
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Description</span></label>
            <textarea v-model="rangeForm.description" class="textarea textarea-bordered w-full" rows="2"></textarea>
          </div>
        </div>

        <div v-if="errorMessage" class="alert alert-error rounded-none mt-4">
          <span>{{ errorMessage }}</span>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/ipam" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Create
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

interface Site {
  id: string
  name: string
}

const route = useRoute()
const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => sitesData.value?.sites as Site[] || [])

const rangeForm = reactive({
  name: '',
  network: '',
  gateway: '',
  vlan: '',
  siteId: (route.query.siteId as string) || '',
  description: '',
})

const saving = ref(false)
const errorMessage = ref('')

async function saveRange() {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/ipam/ranges', {
      method: 'POST',
      body: {
        ...rangeForm,
        siteId: rangeForm.siteId || null,
      }
    })
    await navigateTo('/ipam')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || 'Failed to save range'
  } finally {
    saving.value = false
  }
}
</script>
