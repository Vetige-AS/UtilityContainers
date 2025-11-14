# Use Node.js 20 LTS with Pandoc pre-installed
FROM node:20-alpine

# Install Pandoc and required dependencies
RUN apk add --no-cache \
    pandoc \
    texlive \
    wget \
    ca-certificates

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

# Start the application
CMD ["npm", "start"]
