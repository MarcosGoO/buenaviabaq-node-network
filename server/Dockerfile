# ─────────────────────────────────────────────
# Stage 1: Builder — compile TypeScript
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src/ ./src/

# Compile
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Runner — production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -S viabaq && adduser -S viabaq -G viabaq

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Use non-root user
USER viabaq

EXPOSE 4000

# Health check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
