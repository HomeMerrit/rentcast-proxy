FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must arrive as build args (Railway passes service variables to Docker builds
# only for declared ARGs). Left unset, the bundle falls back to demo mode.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STREAM_URL
ARG NEXT_PUBLIC_REQUIRE_AUTH
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STREAM_URL=$NEXT_PUBLIC_STREAM_URL \
    NEXT_PUBLIC_REQUIRE_AUTH=$NEXT_PUBLIC_REQUIRE_AUTH
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
