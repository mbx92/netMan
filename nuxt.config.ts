// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

function listenPort() {
  return Number(process.env.PORT || process.env.NUXT_PORT || 3001)
}

/** APP_URL is origin only (no path/port). PORT is appended for localhost. */
function resolveAppUrl() {
  const raw = (process.env.APP_URL || "http://localhost").replace(/\/$/, "")
  const port = listenPort()
  try {
    const url = new URL(raw.includes("://") ? raw : `http://${raw}`)
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1"
    if (isLocal && !url.port) url.port = String(port)
    return url.origin
  } catch {
    return raw
  }
}

const appPort = listenPort()
const appUrl = resolveAppUrl()

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: {
        // Default; overridden by theme plugin from cookie
        "data-theme": "carbon",
      },
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
    },
  },

  devServer: {
    port: appPort,
    // Bind on all interfaces (not just localhost) so LAN devices — e.g. a
    // netMan agent enrolling from another machine — can reach this server.
    host: process.env.NUXT_HOST || "0.0.0.0",
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
        process.env.SSO_REDIRECT_URI || `${appUrl}/api/auth/sso/callback`,
      autoProvision: process.env.SSO_AUTO_PROVISION !== "false",
    },
    public: {
      appUrl,
      appPort,
      ssoRedirectUri:
        process.env.SSO_REDIRECT_URI || `${appUrl}/api/auth/sso/callback`,
      lgMacPrefixes: process.env.LG_MAC_PREFIXES || "",
    },
  },

  // Auto-imports for stores
  imports: {
    dirs: ["stores"],
  },
});
