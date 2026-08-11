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

    <!-- Delete Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }" :open="showDeleteModal || undefined" @close="showDeleteModal = false">
      <div class="modal-box glass-modal rounded-none">
        <h3 class="type-card-title">Delete Site</h3>
        <p class="py-4">
          Are you sure you want to delete <strong>{{ siteToDelete?.name }}</strong>? 
          This action cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" :disabled="deleting" @click="deleteSite">
            <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDeleteModal = false">close</button>
      </form>
    </dialog>

    <!-- Feedback Modal -->
    <dialog class="modal" :class="{ 'modal-open': showFeedbackModal }" :open="showFeedbackModal || undefined" @close="showFeedbackModal = false">
      <div class="modal-box glass-modal rounded-none">
        <div class="flex items-start gap-3">
          <div :class="['w-10 h-10 rounded-none flex items-center justify-center flex-shrink-0', feedbackType === 'success' ? 'bg-success/20 text-success' : feedbackType === 'error' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning']">
            <CheckCircle2 v-if="feedbackType === 'success'" class="w-6 h-6" :stroke-width="2" />
            <XCircle v-else-if="feedbackType === 'error'" class="w-6 h-6" :stroke-width="2" />
            <AlertCircle v-else class="w-6 h-6" :stroke-width="2" />
          </div>
          <div>
            <h3 class="type-card-title">{{ feedbackTitle }}</h3>
            <p class="py-2 text-base-content/80">{{ feedbackMessage }}</p>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="showFeedbackModal = false">OK</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showFeedbackModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle2, HardDrive, Monitor, MoreVertical, Plus, XCircle } from '@lucide/vue'

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

// Feedback modal
const showFeedbackModal = ref(false)
const feedbackType = ref<'success' | 'error' | 'warning'>('success')
const feedbackTitle = ref('')
const feedbackMessage = ref('')

function showFeedback(type: 'success' | 'error' | 'warning', title: string, message: string) {
  feedbackType.value = type
  feedbackTitle.value = title
  feedbackMessage.value = message
  showFeedbackModal.value = true
}

// Delete modal
const showDeleteModal = ref(false)
const deleting = ref(false)
const siteToDelete = ref<Site | null>(null)

function confirmDelete(site: Site) {
  siteToDelete.value = site
  showDeleteModal.value = true
}

async function deleteSite() {
  if (!siteToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/sites/${siteToDelete.value.id}`, {
      method: 'DELETE',
    })
    showDeleteModal.value = false
    siteToDelete.value = null
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Failed to Delete', err.data?.statusMessage || 'An error occurred while deleting the site')
  } finally {
    deleting.value = false
  }
}
</script>
