<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="card bg-base-100 shadow-xl p-8">
      <div class="text-center">
        <!-- Loading Spinner -->
        <div
          v-if="!hasError"
          class="loading loading-spinner loading-lg text-primary"
        ></div>

        <!-- Error Icon -->
        <div v-else class="text-error mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-16 h-16 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <p class="mt-4 text-lg" :class="hasError ? 'text-error' : 'text-base-content'">
          {{ message }}
        </p>

        <!-- Retry Button (shown on error) -->
        <button
          v-if="hasError"
          @click="handleRetry"
          class="btn btn-primary mt-6"
        >
          Kembali ke Login
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const route = useRoute()
const router = useRouter()
const { handleCallback } = useAuth()

const message = ref('Memproses login...')
const hasError = ref(false)

const handleRetry = () => {
  navigateTo('/login')
}

onMounted(async () => {
  const code = route.query.code as string
  const state = route.query.state as string
  const error = route.query.error as string

  // Handle error from SSO
  if (error) {
    hasError.value = true
    message.value = `Login gagal: ${(route.query.error_description as string) || error}`
    setTimeout(() => {
      navigateTo('/login')
    }, 3000)
    return
  }

  // Validate callback parameters
  if (!code || !state) {
    hasError.value = true
    message.value = 'Invalid callback parameters'
    setTimeout(() => {
      navigateTo('/login')
    }, 2000)
    return
  }

  // Process callback
  try {
    await handleCallback(code, state)
    message.value = 'Login berhasil! Redirecting...'
  } catch (err: any) {
    console.error('Callback error:', err)
    hasError.value = true
    message.value = `Login gagal: ${err.message}`
    setTimeout(() => {
      navigateTo('/login')
    }, 3000)
  }
})
</script>
