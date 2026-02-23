FROM node:20-alpine
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
# Using NODE_ENV=production makes npm skip devDependencies automatically
ENV NODE_ENV=production
RUN npm ci --production

# Copy application code
COPY . .

EXPOSE 5001
CMD ["node", "server.js"]
