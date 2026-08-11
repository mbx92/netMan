export default defineNuxtPlugin(() => {
  // Safe before hydrate: user UI is wrapped in <ClientOnly> in the shell.
  // Middleware also restores when navigating client-side.
  useAuthStore().restoreAuth()
})
