<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="type-headline">IP Address Management</h1>
        <p class="type-body-sm text-base-content/60 mt-1">Manage IP ranges and allocations per site</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline" :disabled="syncing" @click="syncFromMikroTik">
          <span v-if="syncing" class="loading loading-spinner loading-sm"></span>
          <RefreshCw v-else class="w-4 h-4" :stroke-width="2" />
          Sync MikroTik
        </button>
        <NuxtLink to="/ipam/ranges/create" class="btn btn-primary">
          <Plus class="w-4 h-4" :stroke-width="2" />
          Add Range
        </NuxtLink>
      </div>
    </div>

    <!-- Site Filter -->
    <div class="bg-base-100 border border-base-300 rounded-none p-4 mb-6">
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
      <div v-else-if="ranges.length === 0" class="bg-base-100 border border-base-300 rounded-none p-8">
        <div class="flex flex-col items-center justify-center text-center">
          <div class="w-16 h-16 rounded-none bg-primary/20 flex items-center justify-center mb-4">
            <LayoutGrid class="w-8 h-8 text-primary" :stroke-width="2" />
          </div>
          <h3 class="type-card-title mb-2">No IP Ranges</h3>
          <p class="text-base-content/60 mb-4">Add an IP range to start managing your network addresses.</p>
          <NuxtLink to="/ipam/ranges/create" class="btn btn-primary">Add IP Range</NuxtLink>
        </div>
      </div>

      <!-- Range Cards -->
      <div v-else class="grid gap-4">
        <div 
          v-for="range in ranges" 
          :key="range.id" 
          class="bg-base-100 border border-base-300 rounded-none p-6 hover:border-primary/50 transition-colors cursor-pointer"
          @click="viewRange(range)"
        >
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="type-card-title">{{ range.name }}</h3>
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
                <NuxtLink :to="`/ipam/ranges/${range.id}/edit`" class="btn btn-ghost btn-sm">
                  <Pencil class="w-4 h-4" :stroke-width="2" />
                </NuxtLink>
                <button class="btn btn-ghost btn-sm text-error" @click="confirmDelete(range)">
                  <Trash2 class="w-4 h-4" :stroke-width="2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }" :open="showDeleteModal || undefined" @close="showDeleteModal = false">
      <div class="modal-box glass-modal rounded-none">
        <h3 class="type-card-title">Delete IP Range</h3>
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
    <dialog class="modal" :class="{ 'modal-open': showDetailModal }" :open="showDetailModal || undefined" @close="showDetailModal = false">
      <div class="modal-box max-w-4xl glass-modal rounded-none">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="type-card-title">{{ selectedRange?.name }}</h3>
            <div class="text-sm text-base-content/60 font-mono">{{ selectedRange?.network }}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle" @click="showDetailModal = false">✕</button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-base-200 rounded-none p-4 text-center">
            <div class="text-2xl font-bold">{{ rangeStats.total }}</div>
            <div class="text-sm text-base-content/60">Total IPs</div>
          </div>
          <div class="bg-success/20 rounded-none p-4 text-center">
            <div class="text-2xl font-bold text-success">{{ rangeStats.free }}</div>
            <div class="text-sm text-base-content/60">Free</div>
          </div>
          <div class="bg-primary/20 rounded-none p-4 text-center">
            <div class="text-2xl font-bold text-primary">{{ rangeStats.used }}</div>
            <div class="text-sm text-base-content/60">Allocated</div>
          </div>
        </div>

        <!-- Add Allocation Form -->
        <div class="bg-base-200 rounded-none p-4 mb-4">
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
              class="aspect-square rounded-none text-xs flex items-center justify-center cursor-pointer transition-colors relative"
              :class="getIpClass(ip)"
              :title="getIpTitle(ip)"
              @click="handleIpClick(ip)"
            >
              <EthernetPort v-if="ip.device" class="w-3 h-3 absolute top-0.5 right-0.5" :stroke-width="2" />
              {{ ip.ip.split('.')[3] }}
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-4 mt-4 text-xs">
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-none bg-base-300"></div> Free</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-none bg-secondary"></div> <EthernetPort class="w-3 h-3" :stroke-width="2" /> Device</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-none bg-primary"></div> Static</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-none bg-info"></div> DHCP</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-none bg-warning"></div> Reserved</div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-none bg-success"></div> Gateway</div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDetailModal = false">close</button>
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

    <!-- Deallocate Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeallocateModal }" :open="showDeallocateModal || undefined" @close="showDeallocateModal = false">
      <div class="modal-box glass-modal rounded-none">
        <h3 class="type-card-title">Deallocate IP</h3>
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
    <dialog class="modal" :class="{ 'modal-open': showSyncPreviewModal }" :open="showSyncPreviewModal || undefined" @close="showSyncPreviewModal = false">
      <div class="modal-box max-w-2xl glass-modal rounded-none">
        <h3 class="type-card-title mb-4">Sync Preview</h3>
        
        <div v-if="syncPreviewLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        
        <div v-else-if="syncPreviewData">
          <!-- Stats -->
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="bg-base-200 rounded-none p-3 text-center">
              <div class="type-card-title">{{ syncPreviewData.stats?.arpEntriesWithMac || 0 }}</div>
              <div class="text-xs text-base-content/60">ARP entries</div>
            </div>
            <div class="bg-success/20 rounded-none p-3 text-center">
              <div class="type-card-title text-success">{{ syncPreviewData.stats?.toAdd || 0 }}</div>
              <div class="text-xs text-base-content/60">To Add</div>
            </div>
            <div class="bg-info/20 rounded-none p-3 text-center">
              <div class="type-card-title text-info">{{ syncPreviewData.stats?.toUpdate || 0 }}</div>
              <div class="text-xs text-base-content/60">To Update</div>
            </div>
          </div>
          
          <!-- Changes list -->
          <div v-if="syncPreviewData.changes?.length" class="max-h-60 overflow-y-auto bg-base-200 rounded-none p-2 mb-4">
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
          <div class="bg-warning/10 border border-warning/30 rounded-none p-3 text-sm mb-4">
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
import { AlertCircle, CheckCircle2, EthernetPort, LayoutGrid, Pencil, Plus, RefreshCw, Trash2, XCircle } from '@lucide/vue'

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
