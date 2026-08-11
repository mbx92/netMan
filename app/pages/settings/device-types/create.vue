<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/settings/device-types" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Device Types
      </NuxtLink>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-6">Add Device Type</h1>

      <form @submit.prevent="saveType">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Code *</span></label>
            <input v-model="formData.code" type="text" class="input input-bordered w-full" placeholder="e.g., NETWORK_DEVICE" required />
            <label class="label"><span class="label-text-alt">Unique identifier (auto uppercased)</span></label>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="formData.name" type="text" class="input input-bordered w-full" placeholder="e.g., Network Device" required />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Color</span></label>
              <input v-model="formData.color" type="color" class="w-full h-10 rounded-none cursor-pointer" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Sort Order</span></label>
              <input v-model.number="formData.sortOrder" type="number" class="input input-bordered w-full" />
            </div>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Topology Tier</span></label>
            <select v-model.number="formData.topologyTier" class="select select-bordered w-full">
              <option :value="0">Tier 0 (Router/Core)</option>
              <option :value="1">Tier 1 (Switch/AP)</option>
              <option :value="2">Tier 2 (End Device)</option>
            </select>
          </div>
          <div class="flex flex-wrap gap-4">
            <label class="cursor-pointer label gap-2">
              <input v-model="formData.isNetworkDevice" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text">Network Device</span>
            </label>
            <label class="cursor-pointer label gap-2">
              <input v-model="formData.canHavePorts" type="checkbox" class="checkbox checkbox-info" />
              <span class="label-text">Can Have Ports</span>
            </label>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/settings/device-types" class="btn btn-ghost">Cancel</NuxtLink>
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

const formData = reactive({
  code: '',
  name: '',
  color: '#6b7280',
  sortOrder: 50,
  topologyTier: 2,
  isNetworkDevice: false,
  canHavePorts: false,
})

const saving = ref(false)

async function saveType() {
  saving.value = true
  try {
    await $fetch('/api/device-types', {
      method: 'POST',
      body: {
        code: formData.code,
        name: formData.name,
        color: formData.color,
        sortOrder: formData.sortOrder,
        topologyTier: formData.topologyTier,
        isNetworkDevice: formData.isNetworkDevice,
        canHavePorts: formData.canHavePorts,
      }
    })
    await navigateTo('/settings/device-types')
  } catch (error: unknown) {
    const err = error as { message?: string }
    alert('Error: ' + (err.message || 'Failed to save'))
  } finally {
    saving.value = false
  }
}
</script>
