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

  modules: ["@pinia/nuxt", "@mbx92/nuxt-sso-client"],

  ssoClient: {
    resolveUser: "server/sso/resolve-user.ts",
    successRedirect: "/auth/callback",
    loginPath: "/login",
  },

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
    sso: {
      issuer: process.env.SSO_ISSUER || process.env.SSO_BASE_URL || "",
      clientId: process.env.SSO_CLIENT_ID || "",
      clientSecret: process.env.SSO_CLIENT_SECRET || "",
      redirectUri:
        process.env.SSO_REDIRECT_URI ||
        "http://localhost:3001/api/auth/sso/callback",
      autoProvision: process.env.SSO_AUTO_PROVISION !== "false",
    },
    public: {
      appUrl: process.env.APP_URL || "http://localhost:3001",
    },
  },

  // Auto-imports for stores
  imports: {
    dirs: ["stores"],
  },
});
