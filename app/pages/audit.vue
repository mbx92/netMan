<template>
  <div class="animate-fade-in">
    <div class="mb-6">
      <h1 class="text-3xl font-bold">Audit Logs</h1>
      <p class="text-base-content/60 mt-1">Track all system actions and changes</p>
    </div>

    <!-- Filters -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-4 mb-6">
      <div class="flex flex-wrap gap-4">
        <input 
          v-model="filters.actor" 
          type="text" 
          placeholder="Filter by actor..." 
          class="input input-bordered w-48"
          @input="debouncedLoad"
        />
        <select v-model="filters.action" class="select select-bordered" @change="loadLogs">
          <option value="">All Actions</option>
          <option value="CREATE_DEVICE">Create Device</option>
          <option value="UPDATE_DEVICE">Update Device</option>
          <option value="DELETE_DEVICE">Delete Device</option>
          <option value="WAKE_ON_LAN">Wake on LAN</option>
        </select>
        <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">
          Clear filters
        </button>
        <button class="btn btn-ghost btn-sm ml-auto" @click="loadLogs">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Logs Table -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr class="bg-base-200/50">
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending" class="h-32">
              <td colspan="6" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!logs.length" class="h-32">
              <td colspan="6" class="text-center text-base-content/60">
                No audit logs found
              </td>
            </tr>
            <tr v-for="log in logs" :key="log.id" class="hover:bg-base-200/50">
              <td class="whitespace-nowrap">
                <div class="text-sm">{{ formatDate(log.createdAt) }}</div>
                <div class="text-xs text-base-content/60">{{ formatTime(log.createdAt) }}</div>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span class="text-xs font-semibold text-primary">{{ log.actor.slice(0, 2).toUpperCase() }}</span>
                  </div>
                  <span class="font-medium">{{ log.actor }}</span>
                </div>
              </td>
              <td>
                <span :class="['badge', getActionBadgeClass(log.action)]">
                  {{ formatAction(log.action) }}
                </span>
              </td>
              <td class="font-mono text-sm">{{ log.target.slice(0, 8) }}...</td>
              <td>
                <span :class="['badge badge-sm', log.result === 'success' ? 'badge-success' : 'badge-error']">
                  {{ log.result }}
                </span>
              </td>
              <td>
                <button 
                  v-if="log.details" 
                  class="btn btn-ghost btn-xs"
                  @click="showDetails(log)"
                >
                  View
                </button>
                <span v-else class="text-base-content/40">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="p-4 border-t border-base-200 flex justify-between items-center">
        <div class="text-sm text-base-content/60">
          Showing {{ logs.length }} of {{ total }} logs
        </div>
        <div class="flex gap-2">
          <button 
            class="btn btn-ghost btn-sm" 
            :disabled="offset === 0"
            @click="prevPage"
          >
            Previous
          </button>
          <button 
            class="btn btn-ghost btn-sm" 
            :disabled="offset + limit >= total"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <dialog :class="['modal', showDetailsModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg mb-4">Log Details</h3>
        <pre class="bg-base-200 p-4 rounded-lg overflow-auto text-sm">{{ JSON.stringify(selectedLog?.details, null, 2) }}</pre>
        <div class="modal-action">
          <button class="btn" @click="showDetailsModal = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDetailsModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
interface AuditLog {
  id: string
  actor: string
  action: string
  target: string
  details: unknown
  result: string
  createdAt: string
}

const filters = reactive({
  actor: '',
  action: '',
})

const offset = ref(0)
const limit = 20

const hasFilters = computed(() => filters.actor || filters.action)

const queryParams = computed(() => {
  const params: Record<string, string | number> = { limit, offset: offset.value }
  if (filters.actor) params.actor = filters.actor
  if (filters.action) params.action = filters.action
  return params
})

const { data, pending, refresh: loadLogs } = await useFetch('/api/audit', {
  query: queryParams,
})

const logs = computed(() => (data.value?.logs as AuditLog[]) || [])
const total = computed(() => data.value?.total || 0)

let searchTimeout: ReturnType<typeof setTimeout>
function debouncedLoad() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadLogs(), 300)
}

function clearFilters() {
  filters.actor = ''
  filters.action = ''
  offset.value = 0
  loadLogs()
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit)
  loadLogs()
}

function nextPage() {
  offset.value += limit
  loadLogs()
}

// Details modal
const showDetailsModal = ref(false)
const selectedLog = ref<AuditLog | null>(null)

function showDetails(log: AuditLog) {
  selectedLog.value = log
  showDetailsModal.value = true
}

// Display helpers
function getActionBadgeClass(action: string): string {
  if (action.includes('CREATE')) return 'badge-success'
  if (action.includes('DELETE')) return 'badge-error'
  if (action.includes('UPDATE')) return 'badge-info'
  if (action.includes('WAKE')) return 'badge-warning'
  return 'badge-ghost'
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
