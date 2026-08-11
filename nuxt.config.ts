// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: {
        // Default; overridden by theme plugin from cookie
        "data-theme": "carbon",
      },
    },
  },

  devServer: {
    port: 3001,
  },

  modules: ["@pinia/nuxt"],

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
  },

  nitro: {
    experimental: {
      websocket: true,
    },
  },

  runtimeConfig: {
    authSecret: process.env.AUTH_SECRET || "netman-dev-secret-change-me",
    // Public keys (available on client-side)
    // Note: clientSecret is public because SSO requires it in POST body for token exchange
    public: {
      sso: {
        baseUrl: process.env.SSO_BASE_URL || "https://sso.yourdomain.com",
        clientId: process.env.SSO_CLIENT_ID || "",
        clientSecret: process.env.SSO_CLIENT_SECRET || "",
        redirectUri:
          process.env.SSO_REDIRECT_URI || "http://localhost:3001/auth/callback",
        scopes: ["openid", "profile", "email"],
      },
    },
  },

  // Auto-imports for stores
  imports: {
    dirs: ["stores"],
  },
});
