<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold">Sites</h1>
        <p class="text-base-content/60 mt-1">
          Manage building/location sites
        </p>
      </div>
      <button class="btn btn-primary" @click="showAddModal = true">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Site
      </button>
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
        class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6 hover:shadow-xl transition-shadow"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-semibold">{{ site.name }}</h3>
            <p v-if="site.location" class="text-sm text-base-content/60">{{ site.location }}</p>
          </div>
          <div class="dropdown dropdown-end">
            <button tabindex="0" class="btn btn-ghost btn-sm btn-circle">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40">
              <li><a @click="editSite(site)">Edit</a></li>
              <li><a class="text-error" @click="confirmDelete(site)">Delete</a></li>
            </ul>
          </div>
        </div>
        
        <p v-if="site.description" class="text-sm text-base-content/70 mb-4">
          {{ site.description }}
        </p>

        <div class="flex gap-4 text-sm">
          <div class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>{{ site.deviceCount }} devices</span>
          </div>
          <div class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            <span>{{ site.mikrotikCount }} routers</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Site Modal -->
    <dialog :class="['modal', showAddModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg mb-4">{{ editingSite ? 'Edit Site' : 'Add New Site' }}</h3>
        <form @submit.prevent="saveSite">
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Name *</span></label>
              <input v-model="siteForm.name" type="text" class="input input-bordered w-full" placeholder="e.g., Gedung A" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Location</span></label>
              <input v-model="siteForm.location" type="text" class="input input-bordered w-full" placeholder="e.g., Jl. Contoh No. 123" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Description</span></label>
              <textarea v-model="siteForm.description" class="textarea textarea-bordered w-full" rows="2" placeholder="Optional description"></textarea>
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              {{ editingSite ? 'Save Changes' : 'Add Site' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeModal">close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog :class="['modal', showDeleteModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg">Delete Site</h3>
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
    <dialog :class="['modal', showFeedbackModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <div class="flex items-start gap-3">
          <div :class="['w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', feedbackType === 'success' ? 'bg-success/20 text-success' : feedbackType === 'error' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning']">
            <svg v-if="feedbackType === 'success'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <svg v-else-if="feedbackType === 'error'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <h3 class="font-bold text-lg">{{ feedbackTitle }}</h3>
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

// Add/Edit modal
const showAddModal = ref(false)
const saving = ref(false)
const editingSite = ref<Site | null>(null)
const siteForm = reactive({
  name: '',
  description: '',
  location: '',
})

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

function editSite(site: Site) {
  editingSite.value = site
  siteForm.name = site.name
  siteForm.description = site.description || ''
  siteForm.location = site.location || ''
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingSite.value = null
  siteForm.name = ''
  siteForm.description = ''
  siteForm.location = ''
}

async function saveSite() {
  saving.value = true
  try {
    if (editingSite.value) {
      await $fetch(`/api/sites/${editingSite.value.id}`, {
        method: 'PUT',
        body: siteForm,
      })
    } else {
      await $fetch('/api/sites', {
        method: 'POST',
        body: siteForm,
      })
    }
    closeModal()
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Failed to Save', err.data?.statusMessage || 'An error occurred while saving the site')
  } finally {
    saving.value = false
  }
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
