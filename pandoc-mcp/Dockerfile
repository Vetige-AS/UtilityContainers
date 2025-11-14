# Use Node.js 20 LTS (Debian-based for Pandoc support)
FROM node:20-slim

# Install Pandoc and basic dependencies
# Note: For PDF output, you'll need LaTeX. Uncomment the texlive lines below.
RUN apt-get update && apt-get install -y \
    pandoc \
    wget \
    ca-certificates \
    # Uncomment for PDF support (adds ~500MB):
    # texlive-latex-base \
    # texlive-fonts-recommended \
    # texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including dev dependencies for build
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production && npm cache clean --force

# Create data directory for volume mount
RUN mkdir -p /data /workspace

# Expose port (overridable via PORT env var, defaults to 3002)
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3002/health || exit 1

# Start the application
CMD ["npm", "start"]
