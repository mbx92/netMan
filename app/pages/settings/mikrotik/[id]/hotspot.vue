<template>
  <div class="animate-fade-in">
    <div v-if="pending" class="flex items-center justify-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else-if="device">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4 min-w-0">
          <NuxtLink :to="`/settings/mikrotik/${id}`" class="btn btn-ghost btn-circle shrink-0">
            <ArrowLeft class="w-5 h-5" :stroke-width="2" />
          </NuxtLink>
          <div class="min-w-0">
            <h1 class="type-headline truncate">Hotspot IP Binding</h1>
            <p class="type-body-sm text-base-content/60 mt-1 font-mono">
              {{ device.name }} · {{ device.host }}:{{ device.port }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="feedback" class="alert rounded-none mb-6" :class="feedback.type === 'success' ? 'alert-success' : 'alert-error'">
        <span>{{ feedback.message }}</span>
      </div>

      <div class="space-y-6">
        <!-- Hotspot IP Bindings -->
        <div class="bg-base-100 border border-base-300 rounded-none p-6">
          <div class="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 class="type-card-title">Hotspot IP Bindings</h2>
              <p class="type-body-sm text-base-content/60 mt-1">
                Bypass, block, or force-regular an IP/MAC on the hotspot login (/ip/hotspot/ip-binding)
              </p>
            </div>
            <button class="btn btn-outline btn-sm gap-2" :disabled="bindingsLoading" @click="loadBindings">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': bindingsLoading }" :stroke-width="2" />
              Refresh
            </button>
          </div>

          <!-- Add binding form -->
          <form class="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 items-end" @submit.prevent="addBinding">
            <div class="form-control md:col-span-2">
              <label class="label"><span class="label-text text-xs">IP Address *</span></label>
              <input v-model="newBinding.address" type="text" placeholder="192.168.1.50" class="input input-bordered input-sm font-mono" required>
            </div>
            <div class="form-control md:col-span-2">
              <label class="label"><span class="label-text text-xs">MAC Address</span></label>
              <input v-model="newBinding.mac" type="text" placeholder="AA:BB:CC:DD:EE:FF" class="input input-bordered input-sm font-mono">
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text text-xs">Type</span></label>
              <select v-model="newBinding.type" class="select select-bordered select-sm">
                <option value="bypassed">Bypassed</option>
                <option value="regular">Regular</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div class="form-control">
              <button type="submit" class="btn btn-primary btn-sm gap-2" :disabled="addingBinding || !newBinding.address">
                <span v-if="addingBinding" class="loading loading-spinner loading-xs"></span>
                <Plus v-else class="w-4 h-4" :stroke-width="2" />
                Add
              </button>
            </div>
            <div class="form-control md:col-span-6">
              <label class="label"><span class="label-text text-xs">Comment</span></label>
              <input v-model="newBinding.comment" type="text" placeholder="Optional note" class="input input-bordered input-sm">
            </div>
          </form>

          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr class="bg-base-200/50">
                  <th>Address</th>
                  <th>MAC</th>
                  <th>Type</th>
                  <th>Comment</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!bindings.length">
                  <td colspan="5" class="text-center text-base-content/60 py-6">
                    {{ bindingsLoading ? 'Loading...' : 'No hotspot IP bindings on this router.' }}
                  </td>
                </tr>
                <tr v-for="b in bindings" :key="b.id">
                  <td class="font-mono">{{ b.address }}</td>
                  <td class="font-mono text-sm">{{ b.mac || '-' }}</td>
                  <td>
                    <span :class="['badge', typeBadge(b.type)]">{{ b.type }}</span>
                    <span v-if="b.disabled" class="badge badge-ghost ml-1">disabled</span>
                  </td>
                  <td class="text-sm text-base-content/60">{{ b.comment || '-' }}</td>
                  <td class="text-right">
                    <button class="btn btn-ghost btn-xs text-error" :disabled="removingId === b.id" @click="removeBinding(b)">
                      <Trash2 class="w-4 h-4" :stroke-width="2" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- DHCP Leases -->
        <div class="bg-base-100 border border-base-300 rounded-none p-6">
          <div class="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 class="type-card-title">DHCP Leases</h2>
              <p class="type-body-sm text-base-content/60 mt-1">
                Convert a dynamic lease into a static reservation (/ip/dhcp-server/lease)
              </p>
            </div>
            <button class="btn btn-outline btn-sm gap-2" :disabled="leasesLoading" @click="loadLeases">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': leasesLoading }" :stroke-width="2" />
              Refresh
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr class="bg-base-200/50">
                  <th>Address</th>
                  <th>MAC</th>
                  <th>Hostname</th>
                  <th>Server</th>
                  <th>Status</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!leases.length">
                  <td colspan="6" class="text-center text-base-content/60 py-6">
                    {{ leasesLoading ? 'Loading...' : 'No DHCP leases on this router.' }}
                  </td>
                </tr>
                <tr v-for="lease in leases" :key="lease.id">
                  <td class="font-mono">{{ lease.address }}</td>
                  <td class="font-mono text-sm">{{ lease.mac }}</td>
                  <td class="text-sm">{{ lease.hostname || '-' }}</td>
                  <td class="text-sm">{{ lease.server }}</td>
                  <td>
                    <span :class="['badge', lease.dynamic ? 'badge-warning' : 'badge-success']">
                      {{ lease.dynamic ? 'dynamic' : 'static' }}
                    </span>
                    <span class="text-xs text-base-content/60 ml-1">{{ lease.status }}</span>
                  </td>
                  <td class="text-right">
                    <button
                      v-if="lease.dynamic"
                      class="btn btn-outline btn-xs gap-1"
                      :disabled="makingStaticId === lease.id"
                      @click="makeStatic(lease)"
                    >
                      <span v-if="makingStaticId === lease.id" class="loading loading-spinner loading-xs"></span>
                      <Lock v-else class="w-3 h-3" :stroke-width="2" />
                      Make Static
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Lock, Plus, RefreshCw, Trash2 } from '@lucide/vue'

type BindingType = 'bypassed' | 'regular' | 'blocked'

interface HotspotBinding {
  id: string
  address: string
  mac?: string
  toAddress?: string
  server?: string
  type: BindingType
  comment?: string
  disabled?: boolean
}

interface DhcpLease {
  id: string
  address: string
  mac: string
  hostname?: string | null
  server: string
  status: string
  dynamic: boolean
}

const route = useRoute()
const id = route.params.id as string

const { data: device, pending } = await useFetch(`/api/mikrotik/${id}`)

const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)

const bindings = ref<HotspotBinding[]>([])
const bindingsLoading = ref(false)
const addingBinding = ref(false)
const removingId = ref<string | null>(null)
const newBinding = reactive({ address: '', mac: '', type: 'bypassed' as BindingType, comment: '' })

const leases = ref<DhcpLease[]>([])
const leasesLoading = ref(false)
const makingStaticId = ref<string | null>(null)

function typeBadge(type: BindingType) {
  if (type === 'bypassed') return 'badge-success'
  if (type === 'blocked') return 'badge-error'
  return 'badge-ghost'
}

function showError(error: unknown, fallback: string) {
  const err = error as { data?: { statusMessage?: string }; message?: string }
  feedback.value = { type: 'error', message: err.data?.statusMessage || err.message || fallback }
}

async function loadBindings() {
  bindingsLoading.value = true
  try {
    const result = await $fetch<{ bindings: HotspotBinding[] }>(`/api/mikrotik/${id}/hotspot-bindings`)
    bindings.value = result.bindings
  } catch (error) {
    showError(error, 'Failed to load hotspot IP bindings')
  } finally {
    bindingsLoading.value = false
  }
}

async function addBinding() {
  if (!newBinding.address) return
  addingBinding.value = true
  feedback.value = null
  try {
    await $fetch(`/api/mikrotik/${id}/hotspot-bindings`, {
      method: 'POST',
      body: {
        address: newBinding.address,
        mac: newBinding.mac || undefined,
        type: newBinding.type,
        comment: newBinding.comment || undefined,
      },
    })
    feedback.value = { type: 'success', message: `Added ${newBinding.type} binding for ${newBinding.address}` }
    newBinding.address = ''
    newBinding.mac = ''
    newBinding.comment = ''
    newBinding.type = 'bypassed'
    await loadBindings()
  } catch (error) {
    showError(error, 'Failed to add hotspot IP binding')
  } finally {
    addingBinding.value = false
  }
}

async function removeBinding(binding: HotspotBinding) {
  const ok = await confirmDialog({
    title: 'Remove Binding',
    message: `Remove hotspot IP binding for ${binding.address}?`,
    confirmLabel: 'Remove',
    variant: 'danger',
  })
  if (!ok) return

  removingId.value = binding.id
  feedback.value = null
  try {
    await $fetch(`/api/mikrotik/${id}/hotspot-bindings/${binding.id}`, { method: 'DELETE' })
    bindings.value = bindings.value.filter(b => b.id !== binding.id)
    feedback.value = { type: 'success', message: `Removed binding for ${binding.address}` }
  } catch (error) {
    showError(error, 'Failed to remove hotspot IP binding')
  } finally {
    removingId.value = null
  }
}

async function loadLeases() {
  leasesLoading.value = true
  try {
    const result = await $fetch<{ leases: DhcpLease[] }>(`/api/mikrotik/${id}/dhcp-leases`)
    leases.value = result.leases
  } catch (error) {
    showError(error, 'Failed to load DHCP leases')
  } finally {
    leasesLoading.value = false
  }
}

async function makeStatic(lease: DhcpLease) {
  makingStaticId.value = lease.id
  feedback.value = null
  try {
    await $fetch(`/api/mikrotik/${id}/dhcp-leases/${lease.id}/make-static`, { method: 'POST' })
    feedback.value = { type: 'success', message: `${lease.address} is now a static DHCP lease` }
    await loadLeases()
  } catch (error) {
    showError(error, 'Failed to convert lease to static')
  } finally {
    makingStaticId.value = null
  }
}

await Promise.all([loadBindings(), loadLeases()])
</script>
