<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p class="page-kicker mb-2">Settings</p>
        <h1 class="type-headline">Hikvision Devices</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Sync NVR/DVR/camera channels into IPAM
        </p>
      </div>
      <NuxtLink to="/hikvision/create" class="btn btn-primary gap-2">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Device
      </NuxtLink>
    </div>

    <!-- Devices Table -->
    <div class="infra-panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Type</th>
              <th>Model</th>
              <th>Channels</th>
              <th>Last Sync</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td colspan="7" class="text-center py-8">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!devices.length">
              <td colspan="7" class="text-center py-8 text-base-content/60">
                No Hikvision devices found
              </td>
            </tr>
            <tr v-for="device in devices" :key="device.id" :class="{ 'opacity-50': !device.isActive }">
              <td class="font-medium">
                <NuxtLink :to="`/hikvision/${device.id}`" class="text-primary hover:underline">
                  {{ device.name }}
                </NuxtLink>
              </td>
              <td class="font-mono text-sm">{{ device.host }}:{{ device.port }}</td>
              <td>
                <span class="badge badge-outline">{{ device.deviceType }}</span>
              </td>
              <td class="text-sm">{{ device.model || '-' }}</td>
              <td>
                <span class="badge badge-ghost">{{ device.channelCount }}</span>
              </td>
              <td class="text-sm text-base-content/60">
                {{ device.lastSync ? formatDate(device.lastSync) : 'Never' }}
              </td>
              <td class="text-right">
                <div class="flex justify-end gap-1">
                  <button class="btn btn-ghost btn-xs" @click="syncDevice(device)">
                    <RefreshCw class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <NuxtLink :to="`/hikvision/${device.id}/edit`" class="btn btn-ghost btn-xs">
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button class="btn btn-ghost btn-xs text-error" @click="deleteDevice(device)">
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
import { Pencil, Plus, RefreshCw, Trash2 } from '@lucide/vue'

interface HikvisionDevice {
  id: string
  name: string
  host: string
  port: number
  protocol: string
  deviceType: string
  model: string | null
  serialNumber: string | null
  macAddress: string | null
  firmware: string | null
  isActive: boolean
  lastSync: string | null
  siteId: string | null
  site: { id: string; name: string } | null
  channelCount: number
  createdAt: string
  updatedAt: string
}

const { data: response, refresh, pending } = await useFetch<{ devices: HikvisionDevice[]; total: number }>('/api/hikvision')
const devices = computed(() => response.value?.devices || [])

const syncing = ref<string | null>(null)

function formatDate(value: string): string {
  const date = new Date(value)
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function syncDevice(device: HikvisionDevice) {
  syncing.value = device.id
  try {
    await $fetch(`/api/hikvision/${device.id}/sync`, { method: 'POST' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Sync failed: ' + (err.data?.statusMessage || err.message || 'Unknown error'))
  } finally {
    syncing.value = null
  }
}

async function deleteDevice(device: HikvisionDevice) {
  const ok = await confirmDialog({
    title: 'Delete Hikvision Device',
    message: `Delete "${device.name}" (${device.host})? This cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return

  try {
    await $fetch(`/api/hikvision/${device.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Error: ' + (err.data?.statusMessage || err.message || 'Failed to delete device'))
  }
}
</script>
