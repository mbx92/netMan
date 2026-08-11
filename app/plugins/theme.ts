export default defineNuxtPlugin((nuxtApp) => {
  const { theme, initTheme } = useTheme()

  // SSR + client: html data-theme follows cookie-backed state (same on both sides)
  useHead({
    htmlAttrs: {
      'data-theme': theme,
    },
  })

  // Migrate localStorage → cookie only after hydrate
  nuxtApp.hook('app:mounted', () => {
    initTheme()
  })
})
