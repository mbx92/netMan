import { useAuthStore } from '~/stores/auth'
import type { User, AuthTokens } from '~/types/auth'
import { generatePKCE, generateRandomString } from '~/utils/pkce'
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchUserInfo,
  refreshAccessToken,
} from '~/utils/auth'

export const useAuth = () => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const router = useRouter()

  /**
   * Login - Redirect to SSO
   */
  const login = async (returnUrl?: string) => {
    if (!import.meta.client) return

    authStore.setLoading(true)

    try {
      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = await generatePKCE()

      // Generate state and nonce
      const state = generateRandomString(32)
      const nonce = generateRandomString(32)

      // Store PKCE and state in sessionStorage
      sessionStorage.setItem('pkce_code_verifier', codeVerifier)
      sessionStorage.setItem('oauth_state', state)
      sessionStorage.setItem('oauth_nonce', nonce)
      if (returnUrl) {
        sessionStorage.setItem('return_url', returnUrl)
      }

      // Build authorization URL
      const authUrl = buildAuthUrl({
        baseUrl: config.public.sso.baseUrl,
        clientId: config.public.sso.clientId,
        redirectUri: config.public.sso.redirectUri,
        scopes: config.public.sso.scopes as string[],
        state,
        nonce,
        codeChallenge,
      })

      // Redirect to SSO
      window.location.href = authUrl
    } catch (error) {
      console.error('Login error:', error)
      authStore.setLoading(false)
      throw error
    }
  }

  /**
   * Handle OAuth callback
   */
  const handleCallback = async (code: string, state: string) => {
    if (!import.meta.client) return

    authStore.setLoading(true)

    // Verify state
    const savedState = sessionStorage.getItem('oauth_state')
    if (state !== savedState) {
      authStore.setLoading(false)
      throw new Error('Invalid state parameter')
    }

    // Get PKCE verifier
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier')

    try {
      // Exchange code for tokens
      const tokenResponse = await exchangeCodeForTokens({
        baseUrl: config.public.sso.baseUrl,
        clientId: config.public.sso.clientId,
        clientSecret: config.public.sso.clientSecret,
        redirectUri: config.public.sso.redirectUri,
        code,
        codeVerifier: codeVerifier || undefined,
      })

      // Fetch user info
      const userInfo = await fetchUserInfo(
        config.public.sso.baseUrl,
        tokenResponse.access_token
      )

      // Prepare auth data
      const user: User = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        employeeId: userInfo.employee_id,
        department: userInfo.department,
        position: userInfo.position,
        avatarUrl: userInfo.avatar_url,
        roleId: userInfo.role_id,
        roleName: userInfo.role_name,
      }

      const tokens: AuthTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        idToken: tokenResponse.id_token,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      }

      // Save to store
      authStore.setAuth(user, tokens)

      // Clean up session storage
      sessionStorage.removeItem('pkce_code_verifier')
      sessionStorage.removeItem('oauth_state')
      sessionStorage.removeItem('oauth_nonce')

      // Redirect to return URL or home
      const returnUrl = sessionStorage.getItem('return_url') || '/'
      sessionStorage.removeItem('return_url')

      authStore.setLoading(false)
      await router.push(returnUrl)
    } catch (error) {
      console.error('OAuth callback error:', error)
      authStore.setLoading(false)
      throw error
    }
  }

  /**
   * Logout
   */
  const logout = async () => {
    const idToken = authStore.tokens?.idToken

    // Clear local auth
    authStore.clearAuth()

    // Redirect to SSO logout if we have id_token
    if (idToken && import.meta.client) {
      const logoutUrl = new URL(`${config.public.sso.baseUrl}/api/oidc/logout`)
      logoutUrl.searchParams.set('id_token_hint', idToken)
      logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin + '/login')

      window.location.href = logoutUrl.toString()
    } else {
      await router.push('/login')
    }
  }

  /**
   * Refresh token
   */
  const refresh = async () => {
    if (!authStore.tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const tokenResponse = await refreshAccessToken({
        baseUrl: config.public.sso.baseUrl,
        clientId: config.public.sso.clientId,
        clientSecret: config.public.sso.clientSecret,
        refreshToken: authStore.tokens.refreshToken,
      })

      const tokens: AuthTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || authStore.tokens.refreshToken,
        idToken: tokenResponse.id_token || authStore.tokens.idToken,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      }

      authStore.updateTokens(tokens)
    } catch (error) {
      console.error('Token refresh failed:', error)
      // If refresh fails, logout
      await logout()
      throw error
    }
  }

  /**
   * Auto-refresh token if needed
   */
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
    login,
    logout,
    handleCallback,
    refresh,
    ensureValidToken,
  }
}
