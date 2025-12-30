/**
 * Build authorization URL for OIDC flow
 */
export function buildAuthUrl(config: {
  baseUrl: string
  clientId: string
  redirectUri: string
  scopes: string[]
  state: string
  nonce: string
  codeChallenge?: string
}): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: config.state,
    nonce: config.nonce,
  })

  // Add PKCE challenge if provided
  if (config.codeChallenge) {
    params.append('code_challenge', config.codeChallenge)
    params.append('code_challenge_method', 'S256')
  }

  return `${config.baseUrl}/api/oidc/authorize?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(config: {
  baseUrl: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  code: string
  codeVerifier?: string
}): Promise<{
  access_token: string
  refresh_token: string
  id_token: string
  expires_in: number
  token_type: string
}> {
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code: config.code,
  }

  // Add client secret if not using PKCE
  if (config.clientSecret) {
    body.client_secret = config.clientSecret
  }

  // Add PKCE verifier
  if (config.codeVerifier) {
    body.code_verifier = config.codeVerifier
  }

  const response = await $fetch<{
    access_token: string
    refresh_token: string
    id_token: string
    expires_in: number
    token_type: string
  }>(`${config.baseUrl}/api/oidc/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  })

  return response
}

/**
 * Fetch user info from SSO
 */
export async function fetchUserInfo(
  baseUrl: string,
  accessToken: string
): Promise<{
  sub: string
  email: string
  name: string
  employee_id?: string
  department?: string
  position?: string
  avatar_url?: string
  role_id?: string
  role_name?: string
}> {
  return await $fetch(`${baseUrl}/api/oidc/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(config: {
  baseUrl: string
  clientId: string
  clientSecret?: string
  refreshToken: string
}): Promise<{
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_in: number
  token_type: string
}> {
  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: config.refreshToken,
  }

  if (config.clientSecret) {
    body.client_secret = config.clientSecret
  }

  const response = await $fetch<{
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in: number
    token_type: string
  }>(`${config.baseUrl}/api/oidc/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  })

  return response
}
