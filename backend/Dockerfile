FROM node:20-alpine
WORKDIR /usr/src/app

# Install build dependencies for native modules (if needed)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Clean install production dependencies
ENV NODE_ENV=production
RUN npm ci --omit=dev --ignore-scripts || \
    (echo "=== NPM CI FAILED - Dumping debug log ===" && \
     find /root/.npm/_logs -name "*-debug-*.log" -exec cat {} \; && \
     exit 1)

# Copy application code
COPY . .

EXPOSE 5001
CMD ["node", "server.js"]
