<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink :to="`/proxmox/${id}`" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Node Detail
      </NuxtLink>
    </div>

    <div class="infra-panel p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-6">Edit Proxmox Node</h1>

      <div v-if="pending" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <form v-else @submit.prevent="saveNode">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="formData.name" type="text" class="input input-bordered w-full" required />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Host / IP *</span></label>
              <input v-model="formData.host" type="text" class="input input-bordered w-full" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Port</span></label>
              <input v-model.number="formData.port" type="number" class="input input-bordered w-full" />
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">API Token *</span></label>
            <input v-model="formData.token" type="text" class="input input-bordered w-full font-mono" required />
            <label class="label"><span class="label-text-alt text-base-content/50">Format: user@realm!token-name=secret</span></label>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Site</span></label>
            <select v-model="formData.siteId" class="select select-bordered w-full">
              <option value="">-- No site --</option>
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
            </select>
          </div>

          <div class="form-control">
            <label class="cursor-pointer label gap-2 justify-start">
              <input v-model="formData.isActive" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text">Active</span>
            </label>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink :to="`/proxmox/${id}`" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Save Changes
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
const id = route.params.id as string

const { data: nodeResp, pending } = await useFetch<{
  id: string
  name: string
  host: string
  port: number
  isActive: boolean
  siteId: string | null
}>(`/api/proxmox/${id}`)

const { data: sitesResp } = await useFetch<{ sites: Site[] }>('/api/sites')
const sites = computed(() => sitesResp.value?.sites || [])

const formData = reactive({
  name: '',
  host: '',
  port: 8006,
  token: '',
  siteId: '',
  isActive: true,
})

watchEffect(() => {
  if (nodeResp.value) {
    formData.name = nodeResp.value.name
    formData.host = nodeResp.value.host
    formData.port = nodeResp.value.port
    formData.siteId = nodeResp.value.siteId || ''
    formData.isActive = nodeResp.value.isActive
  }
})

const saving = ref(false)

async function saveNode() {
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: formData.name,
      host: formData.host,
      port: formData.port,
      siteId: formData.siteId || null,
      isActive: formData.isActive,
    }
    if (formData.token) {
      body.token = formData.token
    }
    await $fetch(`/api/proxmox/${id}`, { method: 'PUT', body })
    await navigateTo(`/proxmox/${id}`)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    await alertDialog({
      title: 'Error',
      message: err.data?.statusMessage || err.message || 'Failed to save',
      variant: 'danger',
    })
  } finally {
    saving.value = false
  }
}
</script>
