let lastSsoCheck = 0
const SSO_CHECK_INTERVAL = 30_000

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server-side
  if (import.meta.server) return

  const authStore = useAuthStore()
  const { ensureValidToken } = useAuth()
  const { enabled: ssoEnabled, checkSession } = useSso()

  // Restore only if still empty (plugin also restores post-mount)
  if (!authStore.user) {
    authStore.restoreAuth()
  }

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/auth/callback']
  const isPublicRoute = publicRoutes.some((route) => to.path.startsWith(route))

  if (!isPublicRoute) {
    // Protected route - require authentication
    if (!authStore.isAuthenticated) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }

    // Ensure token is valid (auto-refresh if needed)
    try {
      await ensureValidToken()
    } catch (error) {
      console.error('Token validation failed:', error)
      return navigateTo('/login')
    }

    if (ssoEnabled.value && authStore.user?.provider === 'sso') {
      const now = Date.now()
      if (now - lastSsoCheck > SSO_CHECK_INTERVAL) {
        lastSsoCheck = now
        const valid = await checkSession()
        if (!valid) {
          authStore.clearAuth()
          return navigateTo('/login?reason=session_expired')
        }
      }
    }
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // Already authenticated, redirect to home
    return navigateTo('/')
  }
})
