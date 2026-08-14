<template>
  <div class="min-h-screen flex items-center justify-center p-6 login-shell">
    <div class="login-card relative w-full max-w-[28rem] p-10 text-center">
      <XCircle class="w-12 h-12 mx-auto text-error" :stroke-width="2" />
      <p class="page-kicker mt-6 mb-2">{{ statusCode }}</p>
      <h1 class="type-headline mb-3">{{ title }}</h1>
      <p class="type-body-sm text-base-content/60 mb-8">{{ detail }}</p>
      <NuxtLink to="/login" class="btn btn-primary">Back to sign in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircle } from '@lucide/vue'

const props = defineProps<{
  error: {
    statusCode?: number
    message?: string
    url?: string
  }
}>()

const config = useRuntimeConfig()
const statusCode = computed(() => props.error?.statusCode || 404)
const title = computed(() =>
  statusCode.value === 404 ? 'Page not found' : 'Something went wrong',
)
const detail = computed(() => {
  if (isSsoCallback.value) return 'Returning to sign in…'
  return props.error?.message || 'This page does not exist.'
})

function ssoParamsFrom(raw: string) {
  const text = String(raw || '')
  const marker = '/api/auth/sso/callback'
  const idx = text.indexOf(marker)
  if (idx === -1) return null
  const fromPath = text.slice(idx)
  const q = fromPath.indexOf('?')
  if (q === -1) return new URLSearchParams()
  return new URLSearchParams(fromPath.slice(q + 1))
}

const isSsoCallback = computed(() => {
  const raw = `${props.error?.url || ''} ${props.error?.message || ''}`
  return raw.includes('/api/auth/sso/callback')
})

onMounted(async () => {
  const raw = `${props.error?.url || ''} ${props.error?.message || ''}`
  const params = ssoParamsFrom(raw)
  if (!params) return

  const description =
    params.get('error_description') || params.get('error') || 'Login SSO gagal'
  const query: Record<string, string> = { error: description }
  const registered = String(config.public.ssoRedirectUri || '').trim()
  if (registered) query.sso_redirect_uri = registered
  const next = `/login?${new URLSearchParams(query).toString()}`
  await clearError({ redirect: next })
)
</script>
