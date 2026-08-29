# ============================================================
# DEMO WEBSITE DOCKERFILE
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Copy root package files to install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the demo website assets and the host script
COPY demo_website/ ./demo_website/
COPY scripts/demo_host.js ./scripts/

EXPOSE 4000

ENV BACKEND_URL=http://backend:3001

CMD ["node", "scripts/demo_host.js"]
