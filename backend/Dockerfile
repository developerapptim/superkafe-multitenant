FROM node:20-alpine
WORKDIR /usr/src/app

# Install build dependencies for native modules (if needed)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Try multiple strategies to install dependencies
ENV NODE_ENV=production
RUN npm ci --omit=dev --ignore-scripts 2>&1 || { \
    echo "=== Strategy 1 failed, trying npm install ==="; \
    rm -rf node_modules package-lock.json; \
    npm install --production --no-audit --no-fund 2>&1; \
} || { \
    echo "=== All strategies failed - Dumping debug logs ==="; \
    ls -la /root/.npm/_logs/ 2>&1 || true; \
    cat /root/.npm/_logs/*.log 2>&1 || true; \
    exit 1; \
}

# Copy application code
COPY . .

EXPOSE 5001
CMD ["node", "server.js"]
