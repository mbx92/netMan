# Build stage - Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build stage - Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# SSO Configuration - passed as build args
ARG SSO_BASE_URL=https://sso.baliroyalhospital.co.id
ARG SSO_CLIENT_ID
ARG SSO_CLIENT_SECRET
ARG SSO_REDIRECT_URI=https://netman.baliroyalhospital.co.id/auth/callback

ENV SSO_BASE_URL=$SSO_BASE_URL
ENV SSO_CLIENT_ID=$SSO_CLIENT_ID
ENV SSO_CLIENT_SECRET=$SSO_CLIENT_SECRET
ENV SSO_REDIRECT_URI=$SSO_REDIRECT_URI

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy built output
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Install only production dependencies for prisma CLI (needed for migrations)
RUN npm install --omit=dev prisma

EXPOSE 3000

# Start the application
CMD ["node", ".output/server/index.mjs"]
