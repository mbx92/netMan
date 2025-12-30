import { defineStore } from 'pinia'
import type { User, AuthTokens, AuthState } from '~/types/auth'

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: false,
  }),

  getters: {
    isTokenExpired: (state) => {
      if (!state.tokens) return true
      return Date.now() >= state.tokens.expiresAt
    },

    shouldRefreshToken: (state) => {
      if (!state.tokens) return false
      // Refresh 5 minutes before expiry
      return Date.now() >= state.tokens.expiresAt - 5 * 60 * 1000
    },
  },

  actions: {
    /**
     * Set authentication data
     */
    setAuth(user: User, tokens: AuthTokens) {
      this.user = user
      this.tokens = tokens
      this.isAuthenticated = true

      // Save to localStorage for persistence
      if (import.meta.client) {
        localStorage.setItem('auth_user', JSON.stringify(user))
        localStorage.setItem('auth_tokens', JSON.stringify(tokens))
      }
    },

    /**
     * Clear authentication data
     */
    clearAuth() {
      this.user = null
      this.tokens = null
      this.isAuthenticated = false

      if (import.meta.client) {
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_tokens')
      }
    },

    /**
     * Restore auth from localStorage
     */
    restoreAuth() {
      if (!import.meta.client) return

      try {
        const userStr = localStorage.getItem('auth_user')
        const tokensStr = localStorage.getItem('auth_tokens')

        if (userStr && tokensStr) {
          this.user = JSON.parse(userStr)
          this.tokens = JSON.parse(tokensStr)
          this.isAuthenticated = true

          // Check if token is expired
          if (this.isTokenExpired) {
            this.clearAuth()
          }
        }
      } catch (error) {
        console.error('Failed to restore auth:', error)
        this.clearAuth()
      }
    },

    /**
     * Update user data
     */
    updateUser(user: Partial<User>) {
      if (this.user) {
        this.user = { ...this.user, ...user }
        if (import.meta.client) {
          localStorage.setItem('auth_user', JSON.stringify(this.user))
        }
      }
    },

    /**
     * Update tokens
     */
    updateTokens(tokens: AuthTokens) {
      this.tokens = tokens
      if (import.meta.client) {
        localStorage.setItem('auth_tokens', JSON.stringify(tokens))
      }
    },

    /**
     * Set loading state
     */
    setLoading(loading: boolean) {
      this.isLoading = loading
    },
  },
})
