# Use Node.js 20 LTS (required by eventsource@4.0.0)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment to skip Puppeteer download during install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies including dev dependencies for build
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production && npm cache clean --force

# Create data directory for volume mount
RUN mkdir -p /data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set ownership of app files
RUN chown -R nodejs:nodejs /app /data

# Switch to non-root user
USER nodejs

# Expose port (overridable via PORT env var, defaults to 3001)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
