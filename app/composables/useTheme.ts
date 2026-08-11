const THEME_KEY = 'netman-theme'
type ThemeName = 'carbon' | 'carbon_dark'

function normalizeTheme(value: unknown): ThemeName {
  return value === 'carbon_dark' ? 'carbon_dark' : 'carbon'
}

function applyDocumentTheme(theme: ThemeName) {
  if (!import.meta.client) return
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  // Cookie is the SSR/client source of truth
  const themeCookie = useCookie<string>(THEME_KEY, {
    sameSite: 'lax',
    default: () => 'carbon',
  })

  const theme = useState<ThemeName>('theme', () => normalizeTheme(themeCookie.value))

  const isDark = computed(() => theme.value === 'carbon_dark')

  function setTheme(next: ThemeName) {
    const value = normalizeTheme(next)
    theme.value = value
    themeCookie.value = value
    applyDocumentTheme(value)
    if (import.meta.client) {
      localStorage.setItem(THEME_KEY, value)
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'carbon' ? 'carbon_dark' : 'carbon')
  }

  /** After hydrate: prefer existing localStorage once, then keep cookie/storage aligned */
  function initTheme() {
    if (!import.meta.client) return
    const stored = localStorage.getItem(THEME_KEY)
    if ((stored === 'carbon' || stored === 'carbon_dark') && stored !== theme.value) {
      setTheme(stored)
      return
    }
    applyDocumentTheme(theme.value)
    localStorage.setItem(THEME_KEY, theme.value)
    themeCookie.value = theme.value
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    initTheme,
  }
}
