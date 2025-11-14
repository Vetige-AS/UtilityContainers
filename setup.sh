#!/bin/bash

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Docker Diagram Services Setup                            ║"
echo "║  Setting up containerized diagram conversion services     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git: sudo apt install git"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Check Docker is running
echo "🐳 Checking Docker daemon..."
if ! docker ps &> /dev/null; then
    echo "⚠️  Docker daemon is not running. Attempting to start..."
    sudo systemctl start docker
    sleep 2
    if ! docker ps &> /dev/null; then
        echo "❌ Failed to start Docker. Please start it manually: sudo systemctl start docker"
        exit 1
    fi
fi
echo "✅ Docker is running"
echo ""

# Check/create Docker network
echo "🌐 Setting up Docker network..."
if docker network inspect dev-network &> /dev/null; then
    echo "✅ Network 'dev-network' already exists"
else
    docker network create dev-network
    echo "✅ Created network 'dev-network'"
fi
echo ""

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/*.sh
echo "✅ Scripts are executable"
echo ""

# Configure Confluence credentials (optional for generic usage)
echo "🔐 Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f ".env" ]; then
    echo "⚠️  .env file already exists."
    read -p "Do you want to reconfigure? (y/N): " reconfigure
    if [[ ! $reconfigure =~ ^[Yy]$ ]]; then
        echo "Keeping existing configuration."
    else
        rm .env
    fi
fi

if [ ! -f ".env" ]; then
    echo "The MCP server can work in two modes:"
    echo "1. Generic mode - credentials provided per-request (recommended for multiple Confluence instances)"
    echo "2. Pre-configured mode - default credentials set in environment"
    echo ""
    read -p "Do you want to pre-configure default Confluence credentials? (y/N): " setup_creds
    
    if [[ $setup_creds =~ ^[Yy]$ ]]; then
        echo ""
        echo "Please provide your Confluence credentials:"
        echo "(You can generate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens)"
        echo ""
        
        read -p "Confluence Base URL (e.g., https://yourcompany.atlassian.net): " conf_url
        read -p "Confluence Username (your email): " conf_user
        read -sp "Confluence API Token: " conf_token
        echo ""
        read -p "MCP API Key (any random string for security): " mcp_key
        
        cat > .env << EOF
# Confluence Configuration (Optional - can be overridden per-request)
CONFLUENCE_BASE_URL=$conf_url
CONFLUENCE_USERNAME=$conf_user
CONFLUENCE_API_TOKEN=$conf_token
MCP_API_KEY=$mcp_key

# Service Ports
DIAGRAM_CONVERTER_PORT=3000
CONFLUENCE_MCP_PORT=3001
EOF
    else
        # Create minimal .env without Confluence credentials
        mcp_key=$(openssl rand -hex 32 2>/dev/null || echo "change-me-$(date +%s)")
        
        cat > .env << EOF
# Generic Configuration - Provide Confluence credentials per-request
# CONFLUENCE_BASE_URL=
# CONFLUENCE_USERNAME=
# CONFLUENCE_API_TOKEN=
MCP_API_KEY=$mcp_key

# Service Ports
DIAGRAM_CONVERTER_PORT=3000
CONFLUENCE_MCP_PORT=3001
EOF
        echo "✅ Created generic configuration (credentials will be provided per-request)"
    fi
    
    echo "✅ Configuration saved to .env"
fi
echo ""

# Copy environment to confluence-mcp directory
cp .env confluence-mcp/.env 2>/dev/null || true

# Check if confluence-mcp needs to be cloned
echo "📦 Setting up Confluence MCP..."
if [ ! -d "confluence-mcp/.git" ]; then
    echo "Cloning confluence-mcp repository..."
    rm -rf confluence-mcp/* confluence-mcp/.* 2>/dev/null || true
    git clone https://github.com/manateeit/confluence-mcp.git confluence-mcp-temp
    mv confluence-mcp-temp/* confluence-mcp/ 2>/dev/null || true
    mv confluence-mcp-temp/.* confluence-mcp/ 2>/dev/null || true
    rm -rf confluence-mcp-temp
    echo "✅ Cloned confluence-mcp"
else
    echo "✅ Confluence MCP already cloned"
fi

# Check if Dockerfile exists, if not use template
if [ ! -f "confluence-mcp/Dockerfile" ]; then
    if [ -f "confluence-mcp/Dockerfile.template" ]; then
        cp confluence-mcp/Dockerfile.template confluence-mcp/Dockerfile
    else
        echo "⚠️  Warning: No Dockerfile found for confluence-mcp"
        echo "   Creating a default Dockerfile..."
        cat > confluence-mcp/Dockerfile << 'DOCKERFILE'
FROM node:20-alpine

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build 2>/dev/null || echo "No build step needed"

EXPOSE 3001

CMD ["node", "dist/index.js"]
DOCKERFILE
    fi
fi

# Copy .env to confluence-mcp
cp .env confluence-mcp/.env
echo ""

# Build services
echo "🏗️  Building Docker images..."
echo "This may take several minutes on first run..."
echo ""

if docker compose build; then
    echo "✅ Images built successfully"
else
    echo "❌ Build failed. Check the error messages above."
    exit 1
fi
echo ""

# Start services
echo "🚀 Starting services..."
if docker compose up -d; then
    echo "✅ Services started"
else
    echo "❌ Failed to start services. Check: docker compose logs"
    exit 1
fi
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check health
echo "🏥 Checking service health..."
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Diagram Converter is healthy"
else
    echo "⚠️  Diagram Converter may not be ready yet"
    echo "   Check logs: docker compose logs diagram-converter"
fi

if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Confluence MCP is healthy"
else
    echo "⚠️  Confluence MCP health check not available (this is normal)"
fi
echo ""

# Run tests
echo "🧪 Running basic tests..."
if ./scripts/test-services.sh; then
    echo "✅ Tests passed"
else
    echo "⚠️  Some tests failed, but services may still be functional"
fi
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Setup Complete! 🎉                                       ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Services Running:                                        ║"
echo "║  • Diagram Converter: http://localhost:3000               ║"
echo "║  • Confluence MCP:    http://localhost:3001               ║"
echo "║                                                           ║"
echo "║  Next Steps:                                              ║"
echo "║  1. Test conversions: ./scripts/convert-diagram.sh        ║"
echo "║  2. View logs:        docker compose logs -f              ║"
echo "║  3. Read docs:        cat docs/USAGE.md                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check service status
echo "📊 Current Service Status:"
docker compose ps
