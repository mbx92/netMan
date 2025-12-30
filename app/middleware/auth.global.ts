export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server-side
  if (import.meta.server) return

  const authStore = useAuthStore()
  const { ensureValidToken } = useAuth()

  // Restore auth from localStorage on first load
  if (!authStore.isAuthenticated && !authStore.user) {
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
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // Already authenticated, redirect to home
    return navigateTo('/')
  }
})
