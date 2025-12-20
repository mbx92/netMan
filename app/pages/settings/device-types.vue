<template>
  <div class="container mx-auto p-6 max-w-6xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Device Types
        </h1>
        <p class="text-base-content/60 mt-1">Manage device type categories</p>
      </div>
      <button class="btn btn-primary gap-2" @click="openAddModal">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Add Type
      </button>
    </div>

    <!-- Device Types Table -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Order</th>
              <th>Code</th>
              <th>Name</th>
              <th>Color</th>
              <th>Network Device</th>
              <th>Has Ports</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dt in deviceTypes" :key="dt.id" :class="{ 'opacity-50': !dt.isActive }">
              <td>{{ dt.sortOrder }}</td>
              <td><code class="badge badge-ghost">{{ dt.code }}</code></td>
              <td class="font-medium">{{ dt.name }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-full border" :style="{ backgroundColor: dt.color || '#6b7280' }"></div>
                  <span class="text-xs text-base-content/60">{{ dt.color || 'default' }}</span>
                </div>
              </td>
              <td>
                <span :class="['badge', dt.isNetworkDevice ? 'badge-success' : 'badge-ghost']">
                  {{ dt.isNetworkDevice ? 'Yes' : 'No' }}
                </span>
              </td>
              <td>
                <span :class="['badge', dt.canHavePorts ? 'badge-info' : 'badge-ghost']">
                  {{ dt.canHavePorts ? 'Yes' : 'No' }}
                </span>
              </td>
              <td>
                <span class="badge badge-outline">{{ getTierLabel(dt.topologyTier) }}</span>
              </td>
              <td>
                <span :class="['badge', dt.isActive ? 'badge-success' : 'badge-error']">
                  {{ dt.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <div class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" @click="openEditModal(dt)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button v-if="dt.isActive" class="btn btn-ghost btn-xs text-error" @click="deleteType(dt)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <dialog ref="modal" class="modal">
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4">{{ editing ? 'Edit Device Type' : 'Add Device Type' }}</h3>
        <form @submit.prevent="saveType">
          <div class="space-y-4">
            <div class="form-control" v-if="!editing">
              <label class="label"><span class="label-text">Code *</span></label>
              <input v-model="formData.code" type="text" class="input input-bordered w-full" placeholder="e.g., NETWORK_DEVICE" required :disabled="editing" />
              <label class="label"><span class="label-text-alt">Unique identifier (auto uppercased)</span></label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Name *</span></label>
              <input v-model="formData.name" type="text" class="input input-bordered w-full" placeholder="e.g., Network Device" required />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Color</span></label>
                <input v-model="formData.color" type="color" class="w-full h-10 rounded-lg cursor-pointer" />
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
              <label v-if="editing" class="cursor-pointer label gap-2">
                <input v-model="formData.isActive" type="checkbox" class="checkbox checkbox-success" />
                <span class="label-text">Active</span>
              </label>
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              {{ editing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
interface DeviceType {
  id: string
  code: string
  name: string
  icon: string | null
  color: string | null
  isNetworkDevice: boolean
  canHavePorts: boolean
  topologyTier: number
  sortOrder: number
  isActive: boolean
}

// Fetch device types
const { data: deviceTypesData, refresh } = await useFetch<DeviceType[]>('/api/device-types', {
  query: { includeInactive: 'true' }
})
const deviceTypes = computed(() => deviceTypesData.value || [])

// Modal state
const modal = ref<HTMLDialogElement | null>(null)
const editing = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const formData = reactive({
  code: '',
  name: '',
  color: '#6b7280',
  sortOrder: 50,
  topologyTier: 2,
  isNetworkDevice: false,
  canHavePorts: false,
  isActive: true,
})

function getTierLabel(tier: number): string {
  switch (tier) {
    case 0: return 'Router'
    case 1: return 'Switch/AP'
    case 2: return 'Device'
    default: return `Tier ${tier}`
  }
}

function openAddModal() {
  editing.value = false
  editingId.value = null
  formData.code = ''
  formData.name = ''
  formData.color = '#6b7280'
  formData.sortOrder = 50
  formData.topologyTier = 2
  formData.isNetworkDevice = false
  formData.canHavePorts = false
  formData.isActive = true
  modal.value?.showModal()
}

function openEditModal(dt: DeviceType) {
  editing.value = true
  editingId.value = dt.id
  formData.code = dt.code
  formData.name = dt.name
  formData.color = dt.color || '#6b7280'
  formData.sortOrder = dt.sortOrder
  formData.topologyTier = dt.topologyTier
  formData.isNetworkDevice = dt.isNetworkDevice
  formData.canHavePorts = dt.canHavePorts
  formData.isActive = dt.isActive
  modal.value?.showModal()
}

function closeModal() {
  modal.value?.close()
}

async function saveType() {
  saving.value = true
  try {
    if (editing.value && editingId.value) {
      await $fetch(`/api/device-types/${editingId.value}`, {
        method: 'PUT',
        body: {
          name: formData.name,
          color: formData.color,
          sortOrder: formData.sortOrder,
          topologyTier: formData.topologyTier,
          isNetworkDevice: formData.isNetworkDevice,
          canHavePorts: formData.canHavePorts,
          isActive: formData.isActive,
        }
      })
    } else {
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
    }
    closeModal()
    refresh()
  } catch (error: unknown) {
    const err = error as { message?: string }
    alert('Error: ' + (err.message || 'Failed to save'))
  } finally {
    saving.value = false
  }
}

async function deleteType(dt: DeviceType) {
  if (!confirm(`Deactivate device type "${dt.name}"?`)) return
  
  try {
    await $fetch(`/api/device-types/${dt.id}`, { method: 'DELETE' })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, message?: string }
    alert('Error: ' + (err.data?.statusMessage || err.message || 'Failed to delete'))
  }
}
</script>
