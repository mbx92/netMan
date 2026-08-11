<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/sites" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Sites
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="!site" class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">Sites</p>
      <h1 class="type-card-title mb-2">Site not found</h1>
      <p class="type-body-sm text-base-content/60 mb-6">This site may have been deleted.</p>
      <NuxtLink to="/sites" class="btn btn-primary">Back to Sites</NuxtLink>
    </div>

    <div v-else class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">Sites</p>
      <h1 class="type-card-title mb-6">Edit Site</h1>

      <form @submit.prevent="saveSite">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Name *</span></label>
            <input v-model="form.name" type="text" class="input input-bordered w-full" placeholder="e.g., Gedung A" required />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Location</span></label>
            <input v-model="form.location" type="text" class="input input-bordered w-full" placeholder="e.g., Jl. Contoh No. 123" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Description</span></label>
            <textarea v-model="form.description" class="textarea textarea-bordered w-full" rows="2" placeholder="Optional description"></textarea>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/sites" class="btn btn-ghost">Cancel</NuxtLink>
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
  description: string | null
  location: string | null
}

const route = useRoute()
const id = route.params.id as string

const { data: siteData, pending } = await useFetch('/api/sites')
const site = computed(() => {
  const sites = (siteData.value?.sites as Site[] | undefined) || []
  return sites.find(s => s.id === id) || null
})

const form = reactive({
  name: '',
  location: '',
  description: '',
})

watch(site, (value) => {
  if (!value) return
  form.name = value.name
  form.location = value.location || ''
  form.description = value.description || ''
}, { immediate: true })

const saving = ref(false)

async function saveSite() {
  saving.value = true
  try {
    await $fetch(`/api/sites/${id}`, {
      method: 'PUT',
      body: form,
    })
    await navigateTo('/sites')
  } catch (error) {
    console.error('Failed to update site:', error)
  } finally {
    saving.value = false
  }
}
</script>
