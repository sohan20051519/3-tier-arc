# Production Dockerfile for Node.js Express Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Multi-stage production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source files
COPY --from=builder /app/src ./src

# Expose backend port
EXPOSE 5000

# Run the backend service using non-root user
USER node

CMD ["node", "src/server.ts"]
