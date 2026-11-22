# ERP front-end (Next.js standalone) for Coolify / any Docker host.
# NEXT_PUBLIC_* values are baked into the browser bundle at BUILD time: pass them as build args
# (in Coolify, tick "Build Variable" on each). Changing one needs a rebuild, not just a restart.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TENANT_MODE
ARG NEXT_PUBLIC_TENANT_BASE_DOMAIN
ARG NEXT_PUBLIC_CONTENT_BASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_TENANT_MODE=$NEXT_PUBLIC_TENANT_MODE \
    NEXT_PUBLIC_TENANT_BASE_DOMAIN=$NEXT_PUBLIC_TENANT_BASE_DOMAIN \
    NEXT_PUBLIC_CONTENT_BASE_URL=$NEXT_PUBLIC_CONTENT_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_DIST_DIR=.next
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# standalone = server.js + only the node_modules it needs; static assets and public/ are copied beside it
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# This server.js is the one Next generates in .next/standalone, not the repo's dev wrapper
CMD ["node", "server.js"]
