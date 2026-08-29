# ============================================================
# BACKEND DOCKERFILE
# backend/Dockerfile
# ============================================================
FROM node:20-alpine AS base

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy dependency files first (layer caching)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev 2>/dev/null || npm install --production

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Expose ports
EXPOSE 3001 9090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health/live || exit 1

# Run
CMD ["node", "src/app.js"]
