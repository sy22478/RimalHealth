# Rimal Health Production Dockerfile
# Multi-stage build for optimized production image

# ============================================================================
# Stage 1: Base
# ============================================================================
FROM node:20-alpine AS base

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init && \
    rm -rf /var/cache/apk/*

# ============================================================================
# Stage 2: Dependencies
# ============================================================================
FROM base AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# ============================================================================
# Stage 3: Builder
# ============================================================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy application code
COPY . .

# Set build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# ============================================================================
# Stage 4: Production Runner
# ============================================================================
FROM base AS runner

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy public assets
COPY --from=builder /app/public ./public

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
