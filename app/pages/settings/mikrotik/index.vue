<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="type-headline">MikroTik Routers</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Configure MikroTik routers for ARP/DHCP discovery
        </p>
      </div>
      <NuxtLink to="/settings/mikrotik/create" class="btn btn-primary">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Router
      </NuxtLink>
    </div>

    <!-- MikroTik Devices Table -->
    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Status</th>
              <th>Name</th>
              <th>Host</th>
              <th>API Version</th>
              <th>Site</th>
              <th>Last Sync</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending" class="h-32">
              <td colspan="7" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!devices?.length" class="h-32">
              <td colspan="7" class="text-center text-base-content/60">
                No MikroTik routers configured
              </td>
            </tr>
            <tr v-for="device in devices" :key="device.id" class="hover:bg-base-200/50">
              <td>
                <span :class="['badge badge-sm', device.isActive ? 'badge-success' : 'badge-ghost']">
                  {{ device.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="font-medium">
                <NuxtLink :to="`/settings/mikrotik/${device.id}`" class="link link-hover text-primary">
                  {{ device.name }}
                </NuxtLink>
              </td>
              <td class="font-mono text-sm">{{ device.host }}:{{ device.port }}</td>
              <td>
                <span :class="['badge badge-sm', device.apiVersion === 'v7' ? 'badge-info' : 'badge-warning']">
                  ROS {{ device.apiVersion === 'v7' ? '7+' : '6.x' }}
                </span>
              </td>
              <td>{{ device.site?.name || '-' }}</td>
              <td class="text-sm text-base-content/60">{{ formatTimeAgo(device.lastSync) }}</td>
              <td>
                <div class="flex items-center gap-1">
                  <NuxtLink
                    :to="`/settings/mikrotik/${device.id}`"
                    class="btn btn-ghost btn-xs tooltip"
                    data-tip="View Detail"
                  >
                    <Eye class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <NuxtLink 
                    :to="`/settings/mikrotik/${device.id}/edit`" 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Edit Router"
                  >
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Test Connection"
                    :disabled="testing === device.id"
                    @click="testConnection(device)"
                  >
                    <span v-if="testing === device.id" class="loading loading-spinner loading-xs"></span>
                    <CheckCircle2 v-else class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <button 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Sync Now"
                    :disabled="syncing === device.id"
                    @click="syncDevice(device)"
                  >
                    <span v-if="syncing === device.id" class="loading loading-spinner loading-xs"></span>
                    <RefreshCw v-else class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(device)">
                    <Trash2 class="w-4 h-4" :stroke-width="2" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from '@lucide/vue'

interface Site {
  id: string
  name: string
}

interface MikrotikDevice {
  id: string
  name: string
  host: string
  port: number
  username: string
  apiVersion: string
  isActive: boolean
  lastSync: string | null
  siteId: string | null
  site: Site | null
}

// Fetch devices
const { data: deviceData, pending, refresh } = await useFetch('/api/mikrotik')
const devices = computed(() => deviceData.value?.devices as MikrotikDevice[] || [])

const testing = ref<string | null>(null)
async function testConnection(device: MikrotikDevice) {
  testing.value = device.id
  try {
    const result = await $fetch<{ success: boolean; message: string; identity?: string }>(`/api/mikrotik/${device.id}/test`, {
      method: 'POST',
    })
    await alertDialog({
      title: result.success ? 'Connection Successful' : 'Connection Failed',
      message: result.message,
      variant: result.success ? 'primary' : 'danger',
    })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    await alertDialog({
      title: 'Connection Failed',
      message: err.data?.statusMessage || 'Connection test failed',
      variant: 'danger',
    })
  } finally {
    testing.value = null
  }
}

const syncing = ref<string | null>(null)
async function syncDevice(device: MikrotikDevice) {
  syncing.value = device.id
  try {
    const result = await $fetch<{ success: boolean; message: string; devices: number }>(`/api/mikrotik/${device.id}/sync`, {
      method: 'POST',
    })
    await alertDialog({ title: 'Sync Complete', message: result.message })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    await alertDialog({
      title: 'Sync Failed',
      message: err.data?.statusMessage || 'Failed to sync data from router',
      variant: 'danger',
    })
  } finally {
    syncing.value = null
  }
}

async function confirmDelete(device: MikrotikDevice) {
  const ok = await confirmDialog({
    title: 'Delete Router',
    message: `Are you sure you want to delete "${device.name}"?`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await $fetch(`/api/mikrotik/${device.id}`, { method: 'DELETE' })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    await alertDialog({
      title: 'Failed to Delete',
      message: err.data?.statusMessage || 'An error occurred while deleting the router',
      variant: 'danger',
    })
  }
}

const { format: formatTimeAgo } = useFormatTimeAgo()
</script>
