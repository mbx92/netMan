export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()

  // Restore auth on app init
  authStore.restoreAuth()
})
