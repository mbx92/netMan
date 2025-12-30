<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body items-center text-center">
        <!-- Logo -->
        <div class="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-10 h-10 text-primary-content"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <h1 class="card-title text-2xl font-bold">NetMan</h1>
        <p class="text-base-content/70 mb-6">Network Management System</p>

        <div class="divider text-xs text-base-content/50">Login menggunakan akun SSO</div>

        <!-- SSO Login Button -->
        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="btn btn-primary btn-wide gap-2"
        >
          <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
          </svg>
          Login dengan SSO
        </button>

        <!-- Error Message -->
        <div v-if="errorMessage" class="alert alert-error mt-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <p class="text-center text-sm text-base-content/50 mt-6">
          Anda akan diarahkan ke halaman login SSO
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { login, isLoading } = useAuth()
const route = useRoute()
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''
  try {
    const redirect = route.query.redirect as string
    await login(redirect)
  } catch (error: any) {
    errorMessage.value = error.message || 'Terjadi kesalahan saat login'
  }
}

// Check for error from callback
onMounted(() => {
  const error = route.query.error as string
  if (error) {
    errorMessage.value = `Login gagal: ${route.query.error_description || error}`
  }
})
</script>
