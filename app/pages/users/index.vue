<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <p class="page-kicker mb-2">Settings</p>
        <h1 class="type-headline">Users</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Manage local application users and access roles
        </p>
      </div>
      <NuxtLink to="/users/create" class="btn btn-primary gap-2">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add User
      </NuxtLink>
    </div>

    <!-- Users Table -->
    <div class="infra-panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td colspan="6" class="text-center py-8">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!users.length">
              <td colspan="6" class="text-center py-8 text-base-content/60">
                No users found
              </td>
            </tr>
            <tr v-for="user in users" :key="user.id" :class="{ 'opacity-50': !user.isActive }">
              <td class="font-medium">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-primary text-primary-content flex items-center justify-center">
                    <span class="type-caption font-semibold">{{ getInitials(user.name) }}</span>
                  </div>
                  {{ user.name }}
                </div>
              </td>
              <td class="font-mono text-sm">{{ user.email }}</td>
              <td>
                <span class="badge badge-outline">{{ user.roleName }}</span>
              </td>
              <td>
                <span :class="['badge', user.isActive ? 'badge-success' : 'badge-error']">
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="text-sm text-base-content/60">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="text-right">
                <div class="flex justify-end gap-1">
                  <NuxtLink :to="`/users/${user.id}/edit`" class="btn btn-ghost btn-xs">
                    <Pencil class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button class="btn btn-ghost btn-xs text-error" @click="deleteUser(user)">
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

interface AppUser {
  id: string
  email: string
  name: string
  roleName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const { data: usersData, refresh, pending } = await useFetch<AppUser[]>('/api/users')
const users = computed(() => usersData.value || [])

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function formatDate(value: string): string {
  const date = new Date(value)
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

async function deleteUser(user: AppUser) {
  const ok = await confirmDialog({
    title: 'Delete User',
    message: `Delete user "${user.name}" (${user.email})? This cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return

  try {
    await $fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    await alertDialog({
      title: 'Error',
      message: err.data?.statusMessage || err.message || 'Failed to delete user',
      variant: 'danger',
    })
  }
}
</script>
