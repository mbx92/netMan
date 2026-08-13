<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="type-headline">Sites</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Manage building/location sites
        </p>
      </div>
      <NuxtLink to="/sites/create" class="btn btn-primary">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Site
      </NuxtLink>
    </div>

    <!-- Sites Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-if="pending" class="col-span-full flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
      
      <div v-else-if="!sites?.length" class="col-span-full text-center py-12 text-base-content/60">
        No sites configured. Add your first site to get started.
      </div>

      <div 
        v-for="site in sites" 
        :key="site.id" 
        class="bg-base-100 border border-base-300 rounded-none p-6 hover:border-primary/50 transition-colors"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="type-card-title">{{ site.name }}</h3>
            <p v-if="site.location" class="text-sm text-base-content/60">{{ site.location }}</p>
          </div>
          <UiAppDropdown align="end">
            <template #trigger>
              <button type="button" class="btn btn-ghost btn-sm btn-square">
                <MoreVertical class="w-5 h-5" :stroke-width="2" />
              </button>
            </template>
            <template #default="{ close }">
              <ul class="menu w-40">
                <li>
                  <NuxtLink :to="`/sites/${site.id}/edit`" @click="close()">Edit</NuxtLink>
                </li>
                <li><button type="button" class="text-error" @click="confirmDelete(site); close()">Delete</button></li>
              </ul>
            </template>
          </UiAppDropdown>
        </div>
        
        <p v-if="site.description" class="text-sm text-base-content/70 mb-4">
          {{ site.description }}
        </p>

        <div class="flex gap-4 text-sm">
          <div class="flex items-center gap-1">
            <Monitor class="w-4 h-4 text-primary" :stroke-width="2" />
            <span>{{ site.deviceCount }} devices</span>
          </div>
          <div class="flex items-center gap-1">
            <HardDrive class="w-4 h-4 text-accent" :stroke-width="2" />
            <span>{{ site.mikrotikCount }} routers</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { HardDrive, Monitor, MoreVertical, Plus } from '@lucide/vue'

interface Site {
  id: string
  name: string
  description: string | null
  location: string | null
  deviceCount: number
  mikrotikCount: number
}

// Fetch sites
const { data: siteData, pending, refresh } = await useFetch('/api/sites')
const sites = computed(() => siteData.value?.sites as Site[] || [])

async function confirmDelete(site: Site) {
  const ok = await confirmDialog({
    title: 'Delete Site',
    message: `Are you sure you want to delete "${site.name}"?\nThis action cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await $fetch(`/api/sites/${site.id}`, { method: 'DELETE' })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    await alertDialog({
      title: 'Failed to Delete',
      message: err.data?.statusMessage || 'An error occurred while deleting the site',
      variant: 'danger',
    })
  }
}
</script>
