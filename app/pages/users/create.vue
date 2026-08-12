<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/users" class="btn btn-ghost btn-sm">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Users
      </NuxtLink>
    </div>

    <div class="infra-panel p-6">
      <p class="page-kicker mb-2">Settings</p>
      <h1 class="type-card-title mb-6">Add User</h1>

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
              <label class="label"><span class="label-text">Password *</span></label>
              <input v-model="formData.password" type="password" class="input input-bordered w-full" placeholder="Min. 8 characters" required />
              <label class="label"><span class="label-text-alt">At least 8 characters</span></label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Confirm Password *</span></label>
              <input v-model="formData.confirmPassword" type="password" class="input input-bordered w-full" placeholder="Retype password" required />
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
            Create User
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

const formData = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleName: 'admin',
  isActive: true,
})

const saving = ref(false)

async function saveUser() {
  if (formData.password !== formData.confirmPassword) {
    alert('Passwords do not match')
    return
  }

  saving.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        roleName: formData.roleName,
        isActive: formData.isActive,
      },
    })
    await navigateTo('/users')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; message?: string }
    alert('Error: ' + (err.data?.statusMessage || err.message || 'Failed to create user'))
  } finally {
    saving.value = false
  }
}
</script>
