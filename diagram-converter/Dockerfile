FROM node:20-alpine
# Ensure base packages are up-to-date and install system dependencies for ImageMagick, Chromium, and SVG conversion
RUN apk upgrade --no-cache && \
  apk add --no-cache \
    imagemagick \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    wget \
    librsvg

# Install Mermaid CLI globally
RUN npm install -g @mermaid-js/mermaid-cli

# Configure Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm ci when a lockfile is present for reproducible installs)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi && \
  # attempt to automatically fix production vulnerabilities; log errors except for "no vulnerabilities" or "nothing to fix"
  (npm audit fix --production 2>&1 || true) | tee /tmp/npm-audit-fix.log && \
  if grep -q -E "found 0 vulnerabilities|No vulnerabilities found|nothing to fix" /tmp/npm-audit-fix.log; then \
    echo "No vulnerabilities found or nothing to fix."; \
  else \
    echo "npm audit fix encountered an error:"; \
    cat /tmp/npm-audit-fix.log; \
    exit 1; \
  fi

# Copy application code
COPY server.js ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

CMD ["node", "server.js"]
