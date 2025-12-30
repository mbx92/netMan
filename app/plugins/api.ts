export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const { refresh, logout } = useAuth()

  const api = $fetch.create({
    baseURL: '/api', // Your API base URL

    async onRequest({ options }) {
      // Add Authorization header with JWT
      const token = authStore.tokens?.accessToken
      if (token) {
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },

    async onResponseError({ response }) {
      // Auto-refresh on 401
      if (response.status === 401) {
        try {
          await refresh()
          // Note: The request is not automatically retried
          // You may want to implement retry logic here
        } catch (error) {
          console.error('Auto-refresh failed:', error)
          await logout()
        }
      }
    },
  })

  return {
    provide: {
      api,
    },
  }
})
