# Bumply — production image.
#
# Multi-stage so the runtime carries the built app and nothing else: no source,
# no dev dependencies, no build cache. Uses Next's standalone output, which
# traces the exact node_modules the server needs (a few MB instead of ~1GB).
#
# Host-agnostic: works on Coolify, Docker Compose, Fly, or plain `docker run`.
# Coolify autodetects this file; set the env vars listed in DEPLOY.md and point
# the health check at /api/health.

# ---------- deps: install once, cached on package files alone ----------
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat: some native deps (sharp, swc) expect glibc symbols on musl.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next needs NEXT_PUBLIC_* at build time; everything else is read at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Never run the server as root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# standalone bundles the server + traced deps, but NOT public/ or the static
# chunks, so both are copied explicitly. public/ carries the pitch deck at /deck.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Fails the container if the app stops answering, so Coolify restarts it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
