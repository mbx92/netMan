<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/ipam" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to IPAM
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="!range" class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">IPAM</p>
      <h1 class="type-card-title mb-2">IP range not found</h1>
      <p class="type-body-sm text-base-content/60 mb-6">This range may have been deleted.</p>
      <NuxtLink to="/ipam" class="btn btn-primary">Back to IPAM</NuxtLink>
    </div>

    <div v-else class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">IPAM</p>
      <h1 class="type-card-title mb-6">Edit IP Range</h1>

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
            Update
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

interface IPRange {
  id: string
  name: string
  network: string
  gateway: string | null
  vlan: string | null
  description: string | null
  siteId: string | null
}

const route = useRoute()
const id = route.params.id as string

const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => sitesData.value?.sites as Site[] || [])

const { data: rangesData, pending } = await useFetch('/api/ipam/ranges')
const range = computed(() => {
  const ranges = (rangesData.value?.ranges as IPRange[] | undefined) || []
  return ranges.find(r => r.id === id) || null
})

const rangeForm = reactive({
  name: '',
  network: '',
  gateway: '',
  vlan: '',
  siteId: '',
  description: '',
})

watch(range, (value) => {
  if (!value) return
  rangeForm.name = value.name
  rangeForm.network = value.network
  rangeForm.gateway = value.gateway || ''
  rangeForm.vlan = value.vlan || ''
  rangeForm.siteId = value.siteId || ''
  rangeForm.description = value.description || ''
}, { immediate: true })

const saving = ref(false)
const errorMessage = ref('')

async function saveRange() {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/ipam/ranges/${id}`, {
      method: 'PUT',
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
