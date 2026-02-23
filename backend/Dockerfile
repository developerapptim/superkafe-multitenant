FROM node:20-alpine
WORKDIR /usr/src/app

# Install build dependencies for native modules (if needed)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Clean install production dependencies
ENV NODE_ENV=production
RUN npm ci --omit=dev --ignore-scripts || { \
    echo "=== NPM CI FAILED - Dumping debug logs ==="; \
    ls -la /root/.npm/_logs/ || echo "No logs directory found"; \
    cat /root/.npm/_logs/*.log 2>/dev/null || echo "No log files found"; \
    exit 1; \
}

# Copy application code
COPY . .

EXPOSE 5001
CMD ["node", "server.js"]
