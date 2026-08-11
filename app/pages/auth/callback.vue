<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200 p-6">
    <div class="feature-card w-full max-w-sm">
      <div class="text-center">
        <div
          v-if="!hasError"
          class="loading loading-spinner loading-lg text-primary"
        ></div>

        <div v-else class="text-error mb-4">
          <XCircle class="w-16 h-16 mx-auto" :stroke-width="2" />
        </div>

        <p
          class="mt-4 type-body-lg"
          :class="hasError ? 'text-error' : 'text-base-content'"
        >
          {{ message }}
        </p>

        <button
          v-if="hasError"
          @click="handleRetry"
          class="btn btn-primary mt-6"
        >
          Kembali ke login
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircle } from '@lucide/vue'

definePageMeta({
  layout: false,
})

const route = useRoute()
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

  if (error) {
    hasError.value = true
    message.value = `Login gagal: ${(route.query.error_description as string) || error}`
    setTimeout(() => {
      navigateTo('/login')
    }, 3000)
    return
  }

  if (!code || !state) {
    hasError.value = true
    message.value = 'Invalid callback parameters'
    setTimeout(() => {
      navigateTo('/login')
    }, 2000)
    return
  }

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
