<template>
  <div class="min-h-screen flex items-center justify-center p-6 login-shell">
    <!-- Decorative topology nodes (infra atmosphere, not interactive) -->
    <svg
      class="pointer-events-none absolute inset-0 w-full h-full opacity-40"
      aria-hidden="true"
    >
      <g stroke="#0f62fe" stroke-width="1" fill="none" opacity="0.35">
        <line x1="12%" y1="18%" x2="28%" y2="32%" />
        <line x1="28%" y1="32%" x2="18%" y2="58%" />
        <line x1="72%" y1="22%" x2="88%" y2="40%" />
        <line x1="80%" y1="55%" x2="90%" y2="72%" />
      </g>
      <g fill="#0f62fe">
        <rect x="11.2%" y="16.5%" width="10" height="10" />
        <rect x="27.2%" y="30.5%" width="10" height="10" />
        <rect x="17.2%" y="56.5%" width="10" height="10" />
        <rect x="71.2%" y="20.5%" width="10" height="10" />
        <rect x="87.2%" y="38.5%" width="10" height="10" />
        <rect x="79.2%" y="53.5%" width="10" height="10" />
      </g>
    </svg>

    <div class="login-card relative w-full max-w-[28rem] p-10">
      <div class="flex items-center justify-between mb-8 gap-3">
        <div class="flex items-center gap-3">
          <div class="nav-brand-mark w-10 h-10 flex items-center justify-center shrink-0">
            <Network class="w-6 h-6 text-primary-content" :stroke-width="2" />
          </div>
          <div>
            <h1 class="type-card-title">NetMan</h1>
            <p class="type-mono text-base-content/60">Infrastructure control plane</p>
          </div>
        </div>
        <span class="ops-chip ops-chip--live">READY</span>
      </div>

      <p class="page-kicker mb-2">Secure access</p>
      <h2 class="type-headline mb-2">Sign in</h2>
      <p class="type-body-sm text-base-content/60 mb-8">
        Authenticate to manage devices, topology, and IP fabric.
      </p>

      <form class="space-y-5" @submit.prevent="handleLocalLogin">
        <div class="form-control">
          <label class="label" for="email">
            <span class="label-text">Email</span>
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            class="input input-bordered w-full font-mono"
            placeholder="admin@netman.local"
            required
          />
        </div>

        <div class="form-control">
          <label class="label" for="password">
            <span class="label-text">Password</span>
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="input input-bordered w-full"
            placeholder="••••••••"
            required
          />
        </div>

        <div v-if="errorMessage" class="alert alert-error w-full">
          <XCircle class="stroke-current shrink-0 h-5 w-5" :stroke-width="2" />
          <span class="type-body-sm">{{ errorMessage }}</span>
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="isLoading"
        >
          <span v-if="localSubmitting" class="loading loading-spinner loading-sm"></span>
          Sign in to fabric
        </button>
      </form>

      <div class="divider type-caption my-8">or</div>

      <button
        type="button"
        class="btn btn-outline w-full gap-2"
        :disabled="isLoading"
        @click="handleSsoLogin"
      >
        <span v-if="ssoSubmitting" class="loading loading-spinner loading-sm"></span>
        <LogIn v-else class="w-5 h-5" :stroke-width="2" />
        Continue with SSO
      </button>

      <p class="type-mono text-base-content/40 mt-8 text-center">
        LOCAL · SSO · AUDITED SESSION
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LogIn, Network, XCircle } from '@lucide/vue'

definePageMeta({
  layout: false,
})

const { login, loginLocal, isLoading } = useAuth()
const route = useRoute()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const localSubmitting = ref(false)
const ssoSubmitting = ref(false)

const handleLocalLogin = async () => {
  errorMessage.value = ''
  localSubmitting.value = true
  try {
    const redirect = route.query.redirect as string | undefined
    await loginLocal(email.value, password.value, redirect)
  } catch (error: any) {
    errorMessage.value = error.message || 'Terjadi kesalahan saat login'
  } finally {
    localSubmitting.value = false
  }
}

const handleSsoLogin = async () => {
  errorMessage.value = ''
  ssoSubmitting.value = true
  try {
    const redirect = route.query.redirect as string | undefined
    await login(redirect)
  } catch (error: any) {
    errorMessage.value = error.message || 'Terjadi kesalahan saat login SSO'
    ssoSubmitting.value = false
  }
}

onMounted(() => {
  const error = route.query.error as string
  if (error) {
    errorMessage.value = `Login gagal: ${route.query.error_description || error}`
  }
})
</script>
