# ============================================================
# FRONTEND DOCKERFILE
# frontend/Dockerfile
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

# Copy ALL source files (vite.config.js, index.html, src/, public/)
COPY . .

# Build production bundle
RUN npm run build

# ── Serve with a lightweight static server ───────────────────
FROM node:20-alpine AS serve

RUN npm install -g serve

COPY --from=builder /app/dist /app/build

EXPOSE 3000

CMD ["serve", "-s", "/app/build", "-p", "3000"]
