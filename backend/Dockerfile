# Multi-stage production Dockerfile for Node.js Express Backend
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for TypeScript compilation)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy backend source code
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Upgrade OS packages to apply latest security patches
RUN apk update && apk upgrade --no-cache

# Upgrade global npm to latest version to patch bundled node-tar / npm vulnerabilities
RUN npm install -g npm@latest

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Remove global npm and corepack to eliminate build-tool CVE surface in production runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /root/.npm

# Copy compiled JavaScript output from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist

# Expose backend REST API port
EXPOSE 5000

# Run as non-root node user for container security
USER node

# Start the compiled production server
CMD ["node", "dist/server.js"]
