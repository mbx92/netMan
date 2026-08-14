# Build stage - Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm ci

# Build stage - Builder
FROM node:20-alpine AS builder
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

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL and other dependencies for Prisma, curl for the healthcheck
RUN apk add --no-cache openssl libc6-compat curl

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy built output
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server ./server
COPY package*.json ./
COPY packages ./packages
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# Coolify reads this HEALTHCHECK to know when the container is ready to
# receive traffic and to detect a crashed/hung server during redeploys.
# start-period is generous because docker-entrypoint.sh runs migrate deploy
# + db seed (two Prisma engine cold-starts) before the server even binds —
# on a slow DB link that can take well over 30s, which was flapping the
# container to "unhealthy" mid-startup.
HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Apply pending Prisma migrations, seed baseline data (admin user + device
# types), then start the application. Both steps are additive/upsert-only,
# so this is safe to run on every redeploy.
ENTRYPOINT ["./docker-entrypoint.sh"]
