<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/hikvision" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Hikvision Devices
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="!device" class="infra-panel p-6">
      <h1 class="type-card-title mb-2">Device not found</h1>
      <p class="type-body-sm text-base-content/60 mb-6">This device may have been deleted.</p>
      <NuxtLink to="/hikvision" class="btn btn-primary">Back to Hikvision Devices</NuxtLink>
    </div>

    <div v-else class="infra-panel p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-6">Edit Hikvision Device</h1>

      <form @submit.prevent="saveDevice">
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Username</span></label>
              <input v-model="formData.username" type="text" class="input input-bordered w-full" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Password</span></label>
              <input v-model="formData.password" type="password" class="input input-bordered w-full" placeholder="Leave blank to keep current" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Protocol</span></label>
              <select v-model="formData.protocol" class="select select-bordered w-full">
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Device Type</span></label>
              <select v-model="formData.deviceType" class="select select-bordered w-full">
                <option value="NVR">NVR</option>
                <option value="DVR">DVR</option>
                <option value="Camera">Camera</option>
                <option value="AccessControl">Access Control</option>
              </select>
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Site</span></label>
            <select v-model="formData.siteId" class="select select-bordered w-full">
              <option value="">-- No site --</option>
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
            </select>
          </div>

          <div class="form-control flex flex-col justify-end">
            <label class="cursor-pointer label gap-2 justify-start">
              <input v-model="formData.isActive" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text">Active</span>
            </label>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink :to="`/hikvision/${id}`" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Update Device
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

interface HikvisionDevice {
  id: string
  name: string
  host: string
  port: number
  username: string
  protocol: string
  deviceType: string
  siteId: string | null
  isActive: boolean
}

const route = useRoute()
const id = route.params.id as string

const { data: sitesResp } = await useFetch<{ sites: Site[] }>('/api/sites')
const sites = computed(() => sitesResp.value?.sites || [])

const { data: device, pending } = await useFetch<HikvisionDevice>(`/api/hikvision/${id}`)

const formData = reactive({
  name: '',
  host: '',
  port: 80,
  username: 'admin',
  password: '',
  protocol: 'http' as 'http' | 'https',
  deviceType: 'NVR',
  siteId: '',
  isActive: true,
})

watch(device, (d) => {
  if (!d) return
  formData.name = d.name
  formData.host = d.host
  formData.port = d.port
  formData.username = d.username
  formData.password = ''
  formData.protocol = (d.protocol as 'http' | 'https') || 'http'
  formData.deviceType = d.deviceType
  formData.siteId = d.siteId || ''
  formData.isActive = d.isActive
}, { immediate: true })

const saving = ref(false)

async function saveDevice() {
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: formData.name,
      host: formData.host,
      port: formData.port,
      username: formData.username,
      protocol: formData.protocol,
      deviceType: formData.deviceType,
      siteId: formData.siteId || null,
      isActive: formData.isActive,
    }
    if (formData.password) {
      body.password = formData.password
    }

    await $fetch(`/api/hikvision/${id}`, {
      method: 'PUT',
      body,
    })
    await navigateTo('/hikvision')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Error: ' + (err.data?.statusMessage || err.message || 'Failed to update device'))
  } finally {
    saving.value = false
  }
}
</script>
