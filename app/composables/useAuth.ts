import { useAuthStore } from '~/stores/auth'
import type { User, AuthTokens } from '~/types/auth'

export const useAuth = () => {
  const authStore = useAuthStore()
  const router = useRouter()
  const { enabled: ssoEnabled, loginWithSso, logoutFromSso } = useSso()

  const login = async (returnUrl?: string) => {
    if (!ssoEnabled.value) {
      throw new Error('SSO belum dikonfigurasi')
    }
    if (returnUrl && import.meta.client) {
      sessionStorage.setItem('return_url', returnUrl)
    }
    loginWithSso()
  }

  const loginLocal = async (email: string, password: string, returnUrl?: string) => {
    authStore.setLoading(true)
    try {
      const data = await $fetch<{
        user: User
        tokens: AuthTokens
      }>('/api/auth/local/login', {
        method: 'POST',
        body: { email, password },
      })

      authStore.setAuth(
        { ...data.user, provider: 'local' },
        data.tokens,
      )

      authStore.setLoading(false)
      await router.push(returnUrl || '/')
    } catch (error: any) {
      authStore.setLoading(false)
      const message =
        error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Login gagal'
      throw new Error(message)
    }
  }

  const completeSsoHandoff = async () => {
    authStore.setLoading(true)
    try {
      const data = await $fetch<{ user: User; tokens: AuthTokens }>('/api/auth/handoff', {
        credentials: 'include',
      })
      authStore.setAuth({ ...data.user, provider: 'sso' }, data.tokens)

      const returnUrl = import.meta.client
        ? sessionStorage.getItem('return_url') || '/'
        : '/'
      if (import.meta.client) sessionStorage.removeItem('return_url')

      authStore.setLoading(false)
      await router.push(returnUrl)
    } catch (error: any) {
      authStore.setLoading(false)
      const message =
        error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Login SSO gagal'
      throw new Error(message)
    }
  }

  const logout = async () => {
    const provider = authStore.user?.provider || 'local'
    authStore.clearAuth()

    if (provider === 'sso' && ssoEnabled.value && import.meta.client) {
      logoutFromSso()
      return
    }

    await router.push('/login')
  }

  const refresh = async () => {
    if (!authStore.tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const tokenResponse = await $fetch<{
        accessToken: string
        refreshToken: string
        idToken: string
        expiresAt: number
      }>('/api/auth/local/refresh', {
        method: 'POST',
        body: { refreshToken: authStore.tokens.refreshToken },
      })

      authStore.updateTokens({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        idToken: tokenResponse.idToken || '',
        expiresAt: tokenResponse.expiresAt,
      })
    } catch (error) {
      console.error('Token refresh failed:', error)
      await logout()
      throw error
    }
  }

  const ensureValidToken = async () => {
    if (authStore.shouldRefreshToken) {
      await refresh()
    }
  }

  return {
    user: computed(() => authStore.user),
    tokens: computed(() => authStore.tokens),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    isLoading: computed(() => authStore.isLoading),
    ssoEnabled,
    login,
    loginLocal,
    logout,
    completeSsoHandoff,
    refresh,
    ensureValidToken,
  }
}
