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
          class="btn btn-primary mt-6"
          @click="handleRetry"
        >
          Back to login
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

const { completeSsoHandoff } = useAuth()

const message = ref('Finishing SSO sign-in...')
const hasError = ref(false)

const handleRetry = () => {
  navigateTo('/login')
}

onMounted(async () => {
  try {
    await completeSsoHandoff()
    message.value = 'Signed in. Redirecting...'
  } catch (err: unknown) {
    const error = err as { message?: string }
    hasError.value = true
    message.value = error.message || 'SSO sign-in failed'
    setTimeout(() => {
      navigateTo('/login')
    }, 3000)
  }
})
</script>
