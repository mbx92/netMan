<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/settings/mikrotik" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to MikroTik Routers
      </NuxtLink>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-6">Add MikroTik Router</h1>

      <form @submit.prevent="addDevice">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="deviceForm.name" type="text" class="input input-bordered w-full" placeholder="e.g., Core Router Gedung A" required />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Host *</span></label>
              <input v-model="deviceForm.host" type="text" class="input input-bordered w-full" placeholder="10.5.50.1" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Port</span></label>
              <input v-model.number="deviceForm.port" type="number" class="input input-bordered w-full" :placeholder="deviceForm.apiVersion === 'v7' ? '443' : '8728'" />
            </div>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">RouterOS Version *</span></label>
            <div class="flex gap-4">
              <label class="cursor-pointer label justify-start gap-2">
                <input v-model="deviceForm.apiVersion" type="radio" value="v6" class="radio radio-primary" />
                <span class="label-text">ROS 6.x (API)</span>
              </label>
              <label class="cursor-pointer label justify-start gap-2">
                <input v-model="deviceForm.apiVersion" type="radio" value="v7" class="radio radio-primary" />
                <span class="label-text">ROS 7+ (REST)</span>
              </label>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Username *</span></label>
              <input v-model="deviceForm.username" type="text" class="input input-bordered w-full" placeholder="admin" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Password *</span></label>
              <input v-model="deviceForm.password" type="password" class="input input-bordered w-full" required />
            </div>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Site</span></label>
            <select v-model="deviceForm.siteId" class="select select-bordered w-full">
              <option value="">No Site</option>
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
            </select>
          </div>
          <div class="form-control">
            <label class="cursor-pointer label justify-start gap-3">
              <input v-model="deviceForm.testConnection" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text">Test connection before saving</span>
            </label>
          </div>
        </div>

        <div v-if="errorMessage" class="alert alert-error rounded-none mt-4">
          <span>{{ errorMessage }}</span>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/settings/mikrotik" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Add Router
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

const { data: siteData } = await useFetch('/api/sites')
const sites = computed(() => siteData.value?.sites as Site[] || [])

const deviceForm = reactive({
  name: '',
  host: '',
  port: undefined as number | undefined,
  username: '',
  password: '',
  apiVersion: 'v6' as 'v6' | 'v7',
  siteId: '',
  testConnection: true,
})

const saving = ref(false)
const errorMessage = ref('')

async function addDevice() {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/mikrotik', {
      method: 'POST',
      body: {
        ...deviceForm,
        siteId: deviceForm.siteId || undefined,
      },
    })
    await navigateTo('/settings/mikrotik')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || 'An error occurred while adding the router'
  } finally {
    saving.value = false
  }
}
</script>
