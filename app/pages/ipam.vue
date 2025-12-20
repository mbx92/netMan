<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold">IP Address Management</h1>
        <p class="text-base-content/60 mt-1">Manage IP ranges and allocations per site</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline" :disabled="syncing" @click="syncFromMikroTik">
          <span v-if="syncing" class="loading loading-spinner loading-sm"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Sync MikroTik
        </button>
        <button class="btn btn-primary" @click="openAddModal">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Range
        </button>
      </div>
    </div>

    <!-- Site Filter -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="form-control w-full md:w-64">
          <select v-model="selectedSiteId" class="select select-bordered w-full" @change="loadRanges">
            <option value="">All Sites</option>
            <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
          </select>
        </div>
        <div class="text-sm text-base-content/60">
          {{ ranges.length }} IP range{{ ranges.length !== 1 ? 's' : '' }}
        </div>
      </div>
    </div>

    <!-- IP Ranges List -->
    <div class="grid gap-4">
      <!-- Loading -->
      <div v-if="pending" class="flex items-center justify-center h-64">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Empty State -->
      <div v-else-if="ranges.length === 0" class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-8">
        <div class="flex flex-col items-center justify-center text-center">
          <div class="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">No IP Ranges</h3>
          <p class="text-base-content/60 mb-4">Add an IP range to start managing your network addresses.</p>
          <button class="btn btn-primary" @click="openAddModal">Add IP Range</button>
        </div>
      </div>

      <!-- Range Cards -->
      <div v-else class="grid gap-4">
        <div 
          v-for="range in ranges" 
          :key="range.id" 
          class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6 hover:border-primary/50 transition-colors cursor-pointer"
          @click="viewRange(range)"
        >
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-semibold">{{ range.name }}</h3>
                <span v-if="range.site" class="badge badge-outline badge-sm">{{ range.site.name }}</span>
                <span v-if="range.vlan" class="badge badge-ghost badge-sm">VLAN {{ range.vlan }}</span>
              </div>
              <div class="flex flex-wrap gap-4 text-sm text-base-content/60">
                <span class="font-mono">{{ range.network }}</span>
                <span v-if="range.gateway">Gateway: {{ range.gateway }}</span>
                <span v-if="range.description">{{ range.description }}</span>
              </div>
            </div>

            <!-- Usage Stats -->
            <div class="flex items-center gap-6">
              <div class="text-center">
                <div class="text-2xl font-bold text-primary">{{ range.usedIps }}</div>
                <div class="text-xs text-base-content/60">Used</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-success">{{ range.freeIps }}</div>
                <div class="text-xs text-base-content/60">Free</div>
              </div>
              <div class="w-32">
                <div class="flex items-center justify-between text-sm mb-1">
                  <span>{{ range.usagePercent }}%</span>
                </div>
                <progress 
                  class="progress w-full" 
                  :class="range.usagePercent > 80 ? 'progress-error' : range.usagePercent > 50 ? 'progress-warning' : 'progress-success'"
                  :value="range.usagePercent" 
                  max="100"
                ></progress>
              </div>
              <div class="flex gap-1" @click.stop>
                <button class="btn btn-ghost btn-sm" @click="editRange(range)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm text-error" @click="confirmDelete(range)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Range Modal -->
    <dialog :class="['modal', showRangeModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg mb-4">{{ editingRange ? 'Edit' : 'Add' }} IP Range</h3>
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
            <div class="grid grid-cols-2 gap-4">
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
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="showRangeModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              {{ editingRange ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showRangeModal = false">close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog :class="['modal', showDeleteModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg">Delete IP Range</h3>
        <p class="py-4">
          Are you sure you want to delete <strong>{{ rangeToDelete?.name }}</strong>?
          This will also delete all {{ rangeToDelete?.usedIps || 0 }} IP allocations.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" :disabled="deleting" @click="deleteRange">
            <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDeleteModal = false">close</button>
      </form>
    </dialog>

    <!-- Range Detail Modal -->
    <dialog :class="['modal', showDetailModal && 'modal-open']">
      <div class="modal-box max-w-4xl glass-modal">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-bold text-lg">{{ selectedRange?.name }}</h3>
            <div class="text-sm text-base-content/60 font-mono">{{ selectedRange?.network }}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle" @click="showDetailModal = false">✕</button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-base-200 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold">{{ rangeStats.total }}</div>
            <div class="text-sm text-base-content/60">Total IPs</div>
          </div>
          <div class="bg-success/20 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-success">{{ rangeStats.free }}</div>
            <div class="text-sm text-base-content/60">Free</div>
          </div>
          <div class="bg-primary/20 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-primary">{{ rangeStats.used }}</div>
            <div class="text-sm text-base-content/60">Allocated</div>
          </div>
        </div>

        <!-- Add Allocation Form -->
        <div class="bg-base-200 rounded-lg p-4 mb-4">
          <div class="flex gap-2">
            <input v-model="newAllocation.ip" type="text" class="input input-bordered input-sm flex-1 font-mono" placeholder="IP Address" />
            <input v-model="newAllocation.hostname" type="text" class="input input-bordered input-sm flex-1" placeholder="Hostname" />
            <input v-model="newAllocation.mac" type="text" class="input input-bordered input-sm flex-1 font-mono" placeholder="MAC" />
            <select v-model="newAllocation.type" class="select select-bordered select-sm">
              <option value="STATIC">Static</option>
              <option value="RESERVED">Reserved</option>
              <option value="DHCP">DHCP</option>
            </select>
            <button class="btn btn-primary btn-sm" :disabled="addingAllocation" @click="addAllocation">
              <span v-if="addingAllocation" class="loading loading-spinner loading-xs"></span>
              Add
            </button>
          </div>
        </div>

        <!-- IP Grid -->
        <div class="overflow-x-auto max-h-96">
          <div v-if="loadingDetail" class="flex items-center justify-center h-32">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
          <div v-else class="grid grid-cols-8 md:grid-cols-16 gap-1">
            <div 
              v-for="ip in ipGrid" 
              :key="ip.ip"
              class="aspect-square rounded text-xs flex items-center justify-center cursor-pointer transition-colors relative"
              :class="getIpClass(ip)"
              :title="getIpTitle(ip)"
              @click="handleIpClick(ip)"
            >
              <svg v-if="ip.device" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 absolute top-0.5 right-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="1"/><rect x="7" y="10" width="10" height="6" rx="0.5"/><line x1="8" y1="4" x2="8" y2="8"/><line x1="10" y1="4" x2="10" y2="8"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="14" y1="4" x2="14" y2="8"/><line x1="16" y1="4" x2="16" y2="8"/></svg>
              {{ ip.ip.split('.')[3] }}
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-4 mt-4 text-xs">
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-base-300"></div> Free</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-secondary"></div> <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="1"/><rect x="7" y="10" width="10" height="6" rx="0.5"/><line x1="8" y1="4" x2="8" y2="8"/><line x1="10" y1="4" x2="10" y2="8"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="14" y1="4" x2="14" y2="8"/><line x1="16" y1="4" x2="16" y2="8"/></svg> Device</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-primary"></div> Static</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-info"></div> DHCP</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-warning"></div> Reserved</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-success"></div> Gateway</div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDetailModal = false">close</button>
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

    <!-- Deallocate Confirmation Modal -->
    <dialog :class="['modal', showDeallocateModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg">Deallocate IP</h3>
        <p class="py-4">
          Hapus alokasi IP <strong class="font-mono">{{ ipToDeallocate?.ip }}</strong>?
          <br/>
          <span class="text-base-content/60 text-sm">
            IP ini akan menjadi free/tersedia kembali.
          </span>
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeallocateModal = false">Batal</button>
          <button class="btn btn-warning" :disabled="deallocating" @click="confirmDeallocate">
            <span v-if="deallocating" class="loading loading-spinner loading-sm"></span>
            Deallocate
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDeallocateModal = false">close</button>
      </form>
    </dialog>

    <!-- Sync Preview Modal -->
    <dialog :class="['modal', showSyncPreviewModal && 'modal-open']">
      <div class="modal-box max-w-2xl glass-modal">
        <h3 class="font-bold text-lg mb-4">Sync Preview</h3>
        
        <div v-if="syncPreviewLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        
        <div v-else-if="syncPreviewData">
          <!-- Stats -->
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="bg-base-200 rounded-lg p-3 text-center">
              <div class="text-xl font-bold">{{ syncPreviewData.stats?.arpEntriesWithMac || 0 }}</div>
              <div class="text-xs text-base-content/60">ARP entries</div>
            </div>
            <div class="bg-success/20 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-success">{{ syncPreviewData.stats?.toAdd || 0 }}</div>
              <div class="text-xs text-base-content/60">To Add</div>
            </div>
            <div class="bg-info/20 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-info">{{ syncPreviewData.stats?.toUpdate || 0 }}</div>
              <div class="text-xs text-base-content/60">To Update</div>
            </div>
          </div>
          
          <!-- Changes list -->
          <div v-if="syncPreviewData.changes?.length" class="max-h-60 overflow-y-auto bg-base-200 rounded-lg p-2 mb-4">
            <div v-for="change in syncPreviewData.changes" :key="change.ip" class="flex items-center justify-between py-1 px-2 text-sm">
              <div class="flex items-center gap-2">
                <span :class="['badge badge-sm', change.type === 'add' ? 'badge-success' : 'badge-info']">
                  {{ change.type === 'add' ? 'NEW' : 'UPD' }}
                </span>
                <span class="font-mono">{{ change.ip }}</span>
                <span v-if="change.deviceName" class="text-base-content/60">({{ change.deviceName }})</span>
              </div>
              <span class="font-mono text-xs text-base-content/60">{{ formatMac(change.mac) }}</span>
            </div>
          </div>
          <div v-else class="text-center py-4 text-base-content/60">
            Tidak ada perubahan yang perlu dilakukan
          </div>
          
          <!-- Warning -->
          <div class="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm mb-4">
            <strong>⚠️ Catatan:</strong> Sync hanya menambah & update, tidak menghapus allocation yang sudah ada.
          </div>
        </div>
        
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showSyncPreviewModal = false">Batal</button>
          <button 
            class="btn btn-primary" 
            :disabled="syncing || !syncPreviewData?.changes?.length"
            @click="applySyncChanges"
          >
            <span v-if="syncing" class="loading loading-spinner loading-sm"></span>
            Apply {{ syncPreviewData?.changes?.length || 0 }} Changes
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showSyncPreviewModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
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
  site: Site | null
  totalIps: number
  usedIps: number
  freeIps: number
  usagePercent: number
}

interface IPAllocation {
  id: string
  ip: string
  mac: string | null
  hostname: string | null
  type: string
}

interface IPGridItem {
  ip: string
  isGateway: boolean
  allocation: IPAllocation | null
  device: { id: string; name: string; mac: string | null } | null
}

// State
const selectedSiteId = ref('')

// Fetch sites
const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => sitesData.value?.sites as Site[] || [])

// Fetch ranges
const { data: rangesData, pending, refresh: loadRanges } = await useFetch('/api/ipam/ranges', {
  query: computed(() => selectedSiteId.value ? { siteId: selectedSiteId.value } : {})
})
const ranges = computed(() => rangesData.value?.ranges as IPRange[] || [])

// Range modal
const showRangeModal = ref(false)
const saving = ref(false)
const editingRange = ref<IPRange | null>(null)
const rangeForm = reactive({
  name: '',
  network: '',
  gateway: '',
  vlan: '',
  siteId: '',
  description: '',
})

function openAddModal() {
  editingRange.value = null
  Object.assign(rangeForm, {
    name: '',
    network: '',
    gateway: '',
    vlan: '',
    siteId: selectedSiteId.value,
    description: '',
  })
  showRangeModal.value = true
}

function editRange(range: IPRange) {
  editingRange.value = range
  Object.assign(rangeForm, {
    name: range.name,
    network: range.network,
    gateway: range.gateway || '',
    vlan: range.vlan || '',
    siteId: range.siteId || '',
    description: range.description || '',
  })
  showRangeModal.value = true
}

async function saveRange() {
  saving.value = true
  try {
    const url = editingRange.value 
      ? `/api/ipam/ranges/${editingRange.value.id}`
      : '/api/ipam/ranges'
    const method = editingRange.value ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      body: {
        ...rangeForm,
        siteId: rangeForm.siteId || null,
      }
    })
    showRangeModal.value = false
    loadRanges()
    showFeedback('success', 'Success', `IP range ${editingRange.value ? 'updated' : 'created'} successfully`)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Error', err.data?.statusMessage || 'Failed to save range')
  } finally {
    saving.value = false
  }
}

// Delete modal
const showDeleteModal = ref(false)
const deleting = ref(false)
const rangeToDelete = ref<IPRange | null>(null)

function confirmDelete(range: IPRange) {
  rangeToDelete.value = range
  showDeleteModal.value = true
}

async function deleteRange() {
  if (!rangeToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/ipam/ranges/${rangeToDelete.value.id}`, { method: 'DELETE' })
    showDeleteModal.value = false
    loadRanges()
    showFeedback('success', 'Deleted', 'IP range deleted successfully')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Error', err.data?.statusMessage || 'Failed to delete range')
  } finally {
    deleting.value = false
  }
}

// Detail modal
const showDetailModal = ref(false)
const loadingDetail = ref(false)
const selectedRange = ref<IPRange | null>(null)
const ipGrid = ref<IPGridItem[]>([])
const rangeStats = ref({ total: 0, used: 0, free: 0 })

async function viewRange(range: IPRange) {
  selectedRange.value = range
  showDetailModal.value = true
  loadingDetail.value = true
  
  try {
    const data = await $fetch<{
      ipGrid: IPGridItem[]
      stats: { total: number; used: number; free: number; devices: number }
    }>(`/api/ipam/ranges/${range.id}/allocations`)
    ipGrid.value = data.ipGrid
    rangeStats.value = data.stats
  } catch (error) {
    showFeedback('error', 'Error', 'Failed to load range details')
  } finally {
    loadingDetail.value = false
  }
}

// Allocation management
const newAllocation = reactive({
  ip: '',
  hostname: '',
  mac: '',
  type: 'STATIC',
})
const addingAllocation = ref(false)

async function addAllocation() {
  if (!selectedRange.value || !newAllocation.ip) return
  addingAllocation.value = true
  try {
    await $fetch(`/api/ipam/ranges/${selectedRange.value.id}/allocations`, {
      method: 'POST',
      body: newAllocation,
    })
    Object.assign(newAllocation, { ip: '', hostname: '', mac: '', type: 'STATIC' })
    await viewRange(selectedRange.value)
    loadRanges()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Error', err.data?.statusMessage || 'Failed to add allocation')
  } finally {
    addingAllocation.value = false
  }
}

async function handleIpClick(ip: IPGridItem) {
  if (ip.allocation) {
    // Show deallocate modal
    ipToDeallocate.value = ip
    showDeallocateModal.value = true
  } else {
    // Pre-fill for allocation
    newAllocation.ip = ip.ip
  }
}

// Deallocate modal
const showDeallocateModal = ref(false)
const deallocating = ref(false)
const ipToDeallocate = ref<IPGridItem | null>(null)

async function confirmDeallocate() {
  if (!ipToDeallocate.value?.allocation) return
  deallocating.value = true
  try {
    await $fetch(`/api/ipam/allocations/${ipToDeallocate.value.allocation.id}`, { method: 'DELETE' })
    showDeallocateModal.value = false
    if (selectedRange.value) await viewRange(selectedRange.value)
    loadRanges()
  } catch (error) {
    showFeedback('error', 'Error', 'Failed to deallocate IP')
  } finally {
    deallocating.value = false
  }
}

function getIpClass(ip: IPGridItem): string {
  if (ip.isGateway) return 'bg-success text-success-content'
  // If has device from Devices module = special color
  if (ip.device) return 'bg-secondary text-secondary-content'
  if (!ip.allocation) return 'bg-base-300 hover:bg-base-200'
  switch (ip.allocation.type) {
    case 'STATIC': return 'bg-primary text-primary-content'
    case 'DHCP': return 'bg-info text-info-content'
    case 'RESERVED': return 'bg-warning text-warning-content'
    default: return 'bg-base-300'
  }
}

function getIpTitle(ip: IPGridItem): string {
  if (ip.isGateway) return `${ip.ip} (Gateway)`
  if (ip.device) return `${ip.ip}\nDevice: ${ip.device.name}\n${ip.device.mac || ''}`
  if (!ip.allocation) return `${ip.ip} (Free)`
  return `${ip.ip}\n${ip.allocation.hostname || ''}\n${ip.allocation.mac || ''}\n${ip.allocation.type}`
}

// Sync from MikroTik with preview
const syncing = ref(false)
const showSyncPreviewModal = ref(false)
const syncPreviewLoading = ref(false)
const syncPreviewData = ref<{
  stats?: { arpEntriesWithMac: number; toAdd: number; toUpdate: number }
  changes?: { type: string; ip: string; mac: string; deviceName?: string }[]
} | null>(null)

async function syncFromMikroTik() {
  // First, get preview
  syncPreviewLoading.value = true
  showSyncPreviewModal.value = true
  syncPreviewData.value = null
  
  try {
    const result = await $fetch<{
      stats: { arpEntriesWithMac: number; toAdd: number; toUpdate: number }
      changes: { type: string; ip: string; mac: string; deviceName?: string }[]
    }>('/api/ipam/sync', {
      method: 'POST',
      body: { siteId: selectedSiteId.value || undefined, mode: 'preview' }
    })
    syncPreviewData.value = result
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Sync Failed', err.data?.statusMessage || 'Failed to get sync preview')
    showSyncPreviewModal.value = false
  } finally {
    syncPreviewLoading.value = false
  }
}

async function applySyncChanges() {
  syncing.value = true
  try {
    const result = await $fetch<{ message: string }>('/api/ipam/sync', {
      method: 'POST',
      body: { siteId: selectedSiteId.value || undefined, mode: 'apply' }
    })
    showSyncPreviewModal.value = false
    loadRanges()
    showFeedback('success', 'Sync Complete', result.message)
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Sync Failed', err.data?.statusMessage || 'Failed to apply sync')
  } finally {
    syncing.value = false
  }
}

function formatMac(mac: string | null): string {
  if (!mac) return '-'
  const clean = mac.replace(/[:-]/g, '').toLowerCase()
  return clean.match(/.{1,2}/g)?.join(':') || mac
}

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
</script>

<style scoped>
.grid-cols-16 {
  grid-template-columns: repeat(16, minmax(0, 1fr));
}
</style>
