# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install Python and build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY miniapp/ ./miniapp/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create data directory for SQLite
RUN mkdir -p data && chown -R nodejs:nodejs data

USER nodejs

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/index.js"]