<template>
  <div class="min-h-screen flex items-center justify-center p-6 login-shell">
    <div class="login-card relative w-full max-w-[24rem] p-10">
      <div class="flex flex-col items-center text-center gap-4">
        <div
          v-if="!hasError"
          class="loading loading-spinner loading-lg text-primary"
        ></div>

        <XCircle
          v-else
          class="w-16 h-16 text-error"
          :stroke-width="2"
        />

        <p
          class="type-body-lg break-words max-w-full"
          :class="hasError ? 'text-error' : 'text-base-content'"
        >
          {{ message }}
        </p>

        <button
          v-if="hasError"
          class="btn btn-primary w-full mt-2"
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
