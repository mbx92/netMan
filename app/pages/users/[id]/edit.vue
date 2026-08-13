<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/users" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Users
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="!user" class="infra-panel p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-2">User not found</h1>
      <p class="type-body-sm text-base-content/60 mb-6">This user may have been deleted.</p>
      <NuxtLink to="/users" class="btn btn-primary">Back to Users</NuxtLink>
    </div>

    <div v-else class="infra-panel p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-6">Edit User</h1>

      <form @submit.prevent="saveUser">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Full Name *</span></label>
            <input v-model="formData.name" type="text" class="input input-bordered w-full" placeholder="e.g., John Doe" required />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Email *</span></label>
            <input v-model="formData.email" type="email" class="input input-bordered w-full" placeholder="user@example.com" required />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">New Password</span></label>
              <input v-model="formData.password" type="password" class="input input-bordered w-full" placeholder="Leave blank to keep current" />
              <label class="label"><span class="label-text-alt">Min. 8 characters if changing</span></label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Confirm New Password</span></label>
              <input v-model="formData.confirmPassword" type="password" class="input input-bordered w-full" placeholder="Retype new password" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Role</span></label>
              <select v-model="formData.roleName" class="select select-bordered w-full">
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div class="form-control flex flex-col justify-end">
              <label class="cursor-pointer label gap-2 justify-start">
                <input v-model="formData.isActive" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text">Active</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <NuxtLink to="/users" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Update User
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

interface AppUser {
  id: string
  email: string
  name: string
  roleName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const id = route.params.id as string

const { data: user, pending } = await useFetch<AppUser>(`/api/users/${id}`)

const formData = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleName: 'admin',
  isActive: true,
})

watch(user, (u) => {
  if (!u) return
  formData.name = u.name
  formData.email = u.email
  formData.roleName = u.roleName
  formData.isActive = u.isActive
  formData.password = ''
  formData.confirmPassword = ''
}, { immediate: true })

const saving = ref(false)

async function saveUser() {
  if (formData.password && formData.password !== formData.confirmPassword) {
    await alertDialog({ title: 'Validation', message: 'Passwords do not match', variant: 'warning' })
    return
  }

  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: formData.name,
      email: formData.email,
      roleName: formData.roleName,
      isActive: formData.isActive,
    }
    if (formData.password) {
      body.password = formData.password
    }

    await $fetch(`/api/users/${id}`, {
      method: 'PUT',
      body,
    })
    await navigateTo('/users')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    await alertDialog({
      title: 'Error',
      message: err.data?.statusMessage || err.message || 'Failed to update user',
      variant: 'danger',
    })
  } finally {
    saving.value = false
  }
}
</script>
