<template>
  <div class="container mx-auto p-6 max-w-6xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="type-headline">
          Device Types
        </h1>
        <p class="type-body-sm text-base-content/60 mt-1">Manage device type categories</p>
      </div>
      <NuxtLink to="/settings/device-types/create" class="btn btn-primary gap-2">
        <Plus class="w-5 h-5" :stroke-width="2" />
        Add Type
      </NuxtLink>
    </div>

    <!-- Device Types Table -->
    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
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
                  <div class="w-6 h-6 rounded-none border" :style="{ backgroundColor: dt.color || '#6b7280' }"></div>
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
                  <NuxtLink :to="`/settings/device-types/${dt.id}/edit`" class="btn btn-ghost btn-xs">
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button v-if="dt.isActive" class="btn btn-ghost btn-xs text-error" @click="deleteType(dt)">
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
import { Pencil, Plus, Trash2 } from '@lucide/vue'

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

function getTierLabel(tier: number): string {
  switch (tier) {
    case 0: return 'Router'
    case 1: return 'Switch/AP'
    case 2: return 'Device'
    default: return `Tier ${tier}`
  }
}

async function deleteType(dt: DeviceType) {
  const ok = await confirmDialog({
    title: 'Deactivate Device Type',
    message: `Deactivate device type "${dt.name}"?`,
    confirmLabel: 'Deactivate',
    variant: 'danger',
  })
  if (!ok) return

  try {
    await $fetch(`/api/device-types/${dt.id}`, { method: 'DELETE' })
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, message?: string }
    await alertDialog({
      title: 'Error',
      message: err.data?.statusMessage || err.message || 'Failed to delete',
      variant: 'danger',
    })
  }
}
</script>
