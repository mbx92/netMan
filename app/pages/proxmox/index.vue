<template>
  <div class="animate-fade-in">
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p class="page-kicker mb-2">Settings</p>
        <h1 class="type-headline">Proxmox Nodes</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Sync VMs, LXCs, storage, and network into IPAM
        </p>
      </div>
      <NuxtLink to="/proxmox/create" class="btn btn-primary gap-2">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Node
      </NuxtLink>
    </div>

    <div class="infra-panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Site</th>
              <th>Last Sync</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td colspan="5" class="text-center py-8">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!nodes.length">
              <td colspan="5" class="text-center py-8 text-base-content/60">
                No Proxmox nodes found
              </td>
            </tr>
            <tr v-for="node in nodes" :key="node.id" :class="{ 'opacity-50': !node.isActive }">
              <td class="font-medium">
                <NuxtLink :to="`/proxmox/${node.id}`" class="text-primary hover:underline">
                  {{ node.name }}
                </NuxtLink>
              </td>
              <td class="font-mono text-sm">{{ node.host }}:{{ node.port }}</td>
              <td class="text-sm">{{ node.site?.name || '-' }}</td>
              <td class="text-sm text-base-content/60">
                {{ node.lastSync ? formatDate(node.lastSync) : 'Never' }}
              </td>
              <td class="text-right">
                <div class="flex justify-end gap-1">
                  <button class="btn btn-ghost btn-xs" @click="syncNode(node)">
                    <RefreshCw class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <NuxtLink :to="`/proxmox/${node.id}/edit`" class="btn btn-ghost btn-xs">
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button class="btn btn-ghost btn-xs text-error" @click="deleteNode(node)">
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

interface ProxmoxNode {
  id: string
  name: string
  host: string
  port: number
  isActive: boolean
  lastSync: string | null
  siteId: string | null
  site: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

const { data: response, refresh, pending } = await useFetch<{ nodes: ProxmoxNode[]; total: number }>('/api/proxmox')
const nodes = computed(() => response.value?.nodes || [])

const syncing = ref<string | null>(null)

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function syncNode(node: ProxmoxNode) {
  syncing.value = node.id
  try {
    await $fetch(`/api/proxmox/${node.id}/sync`, { method: 'POST' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Sync failed: ' + (err.data?.statusMessage || err.message || 'Unknown error'))
  } finally {
    syncing.value = null
  }
}

async function deleteNode(node: ProxmoxNode) {
  const ok = await confirmDialog({
    title: 'Delete Proxmox Node',
    message: `Delete "${node.name}" (${node.host})? This cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return

  try {
    await $fetch(`/api/proxmox/${node.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Error: ' + (err.data?.statusMessage || err.message || 'Failed to delete node'))
  }
}
</script>
