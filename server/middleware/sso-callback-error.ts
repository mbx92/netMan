import { getRequestURL, sendRedirect } from 'h3'

/**
 * SSO may bounce an OIDC error to /api/auth/sso/callback even when that
 * URI is not registered (or when the module handler is not matched).
 * Send the user back to /login instead of a dead 404.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.pathname !== '/api/auth/sso/callback') return

  const error = url.searchParams.get('error')
  if (!error) return

  const config = useRuntimeConfig()
  const description =
    url.searchParams.get('error_description') || error || 'Login SSO gagal'
  const login = new URL('/login', config.public.appUrl || url.origin)
  login.searchParams.set('error', description)
  const registered = String(config.public.ssoRedirectUri || '').trim()
  if (registered) {
    login.searchParams.set('sso_redirect_uri', registered)
  }
  return sendRedirect(event, login.toString(), 302)
})
