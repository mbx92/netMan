# Build stage - Agent binaries (cross-compiled; served by
# server/api/agents/download/[platform].get.ts for the install scripts)
FROM golang:1.22-alpine AS agent-builder
WORKDIR /agent
COPY agent/go.mod agent/go.sum ./
RUN go mod download
COPY agent/ ./
ARG APP_URL=https://netman.baliroyalhospital.co.id
RUN mkdir -p /agent/dist \
    && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o /agent/dist/netman-agent-windows.exe ./cmd/netman-agent \
    && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /agent/dist/netman-agent-linux ./cmd/netman-agent \
    && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o /agent/dist/netman-agent-macos ./cmd/netman-agent \
    && mkdir -p /agent/cmd/netman-agent-setup/payload \
    && cp /agent/dist/netman-agent-windows.exe /agent/cmd/netman-agent-setup/payload/netman-agent.exe \
    && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags "-X main.defaultServer=${APP_URL}" -o /agent/dist/NetMan-Agent-Setup.exe ./cmd/netman-agent-setup \
    && touch /agent/dist/.built

# Node stages use Debian bookworm (not slim, not Alpine):
# - Coolify cannot apk/apt (mirrors blocked), so we need an image that
#   already includes the openssl CLI. Slim lacks it; Prisma then defaults to
#   openssl-1.1.x and the schema engine fails on OpenSSL 3.
# - bookworm + debian-openssl-3.0.x matches Prisma's glibc engine.
# COPY --from=agent-builder runs first so BuildKit cannot finalize the Go
# stage and the Node deps stage at the same time. Parallel commits on Coolify
# hit "snapshot does not exist: not found".
FROM node:20-bookworm AS deps
WORKDIR /app
COPY --from=agent-builder /agent/dist/.built /tmp/.agent-built
COPY package*.json ./
COPY packages ./packages
RUN npm ci

# Build stage - Builder
FROM node:20-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# SSO Configuration — @mbx92/nuxt-sso-client
ARG SSO_ISSUER=https://sso.baliroyalhospital.co.id
ARG SSO_CLIENT_ID
ARG SSO_CLIENT_SECRET
ARG SSO_REDIRECT_URI=https://netman.baliroyalhospital.co.id/api/auth/sso/callback
ARG APP_URL=https://netman.baliroyalhospital.co.id

ENV SSO_ISSUER=$SSO_ISSUER
ENV SSO_CLIENT_ID=$SSO_CLIENT_ID
ENV SSO_CLIENT_SECRET=$SSO_CLIENT_SECRET
ENV SSO_REDIRECT_URI=$SSO_REDIRECT_URI
ENV APP_URL=$APP_URL
ENV SSO_AUTO_PROVISION=true
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
# Pin the engine Prisma's CLI picks at migrate/seed (no openssl auto-detect).
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

# Copy built output
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server ./server
COPY --from=agent-builder /agent/dist ./agent/dist
COPY package*.json ./
COPY packages ./packages
COPY docker-entrypoint.sh docker-healthcheck.mjs ./
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# Coolify reads this HEALTHCHECK to know when the container is ready to
# receive traffic and to detect a crashed/hung server during redeploys.
# start-period is generous because docker-entrypoint.sh runs migrate deploy
# + db seed (two Prisma engine cold-starts) before the server even binds —
# on a slow DB link that can take well over 30s, which was flapping the
# container to "unhealthy" mid-startup.
HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=3 \
  CMD node docker-healthcheck.mjs

# Apply pending Prisma migrations, seed baseline data (admin user + device
# types), then start the application. Both steps are additive/upsert-only,
# so this is safe to run on every redeploy.
ENTRYPOINT ["./docker-entrypoint.sh"]
