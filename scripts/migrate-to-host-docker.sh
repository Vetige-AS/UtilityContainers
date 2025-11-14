#!/bin/bash
# Migration script: Docker-in-Docker → Docker-outside-of-Docker
# Helps users migrate from nested Docker to host Docker pattern

set -e

echo "======================================================"
echo "  UtilityContainers Migration Tool"
echo "  Docker-in-Docker → Docker-outside-of-Docker"
echo "======================================================"
echo ""

# Check if running inside a container
if [ -f /.dockerenv ]; then
    echo "❌ ERROR: This script must run on the HOST, not inside devcontainer"
    echo ""
    echo "Please:"
    echo "  1. Exit the devcontainer (close VS Code or Ctrl+Shift+P → 'Reopen Folder Locally')"
    echo "  2. Run this script from your host terminal (WSL2/Linux/macOS)"
    echo ""
    exit 1
fi

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker not found"
    echo "Please install Docker first"
    exit 1
fi

echo "This script will:"
echo "  1. Stop any containers running inside old devcontainer (if accessible)"
echo "  2. Create dev-network on host"
echo "  3. Start utility containers on host"
echo "  4. Update .gitignore"
echo "  5. Provide next steps for devcontainer.json update"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "=== Step 1: Cleanup Old Containers ==="

# Try to stop containers if they exist (may be in old devcontainer or host)
echo "Stopping diagram-converter (if exists)..."
docker stop diagram-converter 2>/dev/null && echo "✅ Stopped diagram-converter" || echo "ℹ️  diagram-converter not running"

echo "Stopping confluence-mcp (if exists)..."
docker stop confluence-mcp 2>/dev/null && echo "✅ Stopped confluence-mcp" || echo "ℹ️  confluence-mcp not running"

echo "Removing diagram-converter (if exists)..."
docker rm diagram-converter 2>/dev/null && echo "✅ Removed diagram-converter" || echo "ℹ️  diagram-converter not found"

echo "Removing confluence-mcp (if exists)..."
docker rm confluence-mcp 2>/dev/null && echo "✅ Removed confluence-mcp" || echo "ℹ️  confluence-mcp not found"

echo ""
echo "=== Step 2: Create Network ==="

docker network create dev-network 2>/dev/null && echo "✅ Created dev-network" || echo "✅ Network dev-network already exists"

echo ""
echo "=== Step 3: Generate API Key (if needed) ==="

if [ -f .env ]; then
    echo "✅ .env file already exists"
    source .env
    if [ -z "$MCP_API_KEY" ]; then
        echo "⚠️  MCP_API_KEY not found in .env, generating new one..."
        MCP_API_KEY=$(openssl rand -hex 32)
        echo "MCP_API_KEY=$MCP_API_KEY" >> .env
        echo "✅ Added MCP_API_KEY to .env"
    else
        echo "✅ Using existing MCP_API_KEY from .env"
    fi
else
    echo "Creating .env file..."
    MCP_API_KEY=$(openssl rand -hex 32)
    cat > .env << EOF
# UtilityContainers Environment Configuration
MCP_API_KEY=$MCP_API_KEY

# Optional: Configure Confluence (or use MCP tools to set up later)
# CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
# CONFLUENCE_USERNAME=your-email@company.com
# CONFLUENCE_API_TOKEN=your-api-token
EOF
    echo "✅ Created .env file with MCP_API_KEY"
fi

echo ""
echo "=== Step 4: Start Containers on Host ==="

echo "Starting diagram-converter..."
docker run -d \
  --name diagram-converter \
  --network dev-network \
  -p 3000:3000 \
  --restart unless-stopped \
  sandhaaland/diagram-converter:latest && echo "✅ diagram-converter started" || {
    echo "⚠️  Failed to start diagram-converter (may already be running)"
}

echo "Starting confluence-mcp..."
docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p 3001:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  --restart unless-stopped \
  sandhaaland/confluence-mcp:latest && echo "✅ confluence-mcp started" || {
    echo "⚠️  Failed to start confluence-mcp (may already be running)"
}

echo ""
echo "=== Step 5: Update .gitignore ==="

if [ -f .gitignore ]; then
    if grep -q "^\.env$" .gitignore; then
        echo "✅ .env already in .gitignore"
    else
        echo "" >> .gitignore
        echo "# UtilityContainers" >> .gitignore
        echo ".env" >> .gitignore
        echo ".vscode/*.agent.md" >> .gitignore
        echo "✅ Updated .gitignore"
    fi
else
    cat > .gitignore << 'EOF'
# UtilityContainers
.env
.vscode/*.agent.md
EOF
    echo "✅ Created .gitignore"
fi

echo ""
echo "=== Step 6: Verify Setup ==="

echo "Checking containers..."
docker ps | grep -E 'diagram-converter|confluence-mcp' || echo "⚠️  Containers not found in docker ps"

echo ""
echo "Testing connectivity..."
if curl -sf http://localhost:3000/health > /dev/null; then
    echo "✅ diagram-converter is responding"
else
    echo "⚠️  diagram-converter not responding at localhost:3000"
fi

if curl -sf http://localhost:3001/health > /dev/null; then
    echo "✅ confluence-mcp is responding"
else
    echo "⚠️  confluence-mcp not responding at localhost:3001"
fi

echo ""
echo "======================================================"
echo "  ✅ Migration Complete!"
echo "======================================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Update .devcontainer/devcontainer.json"
echo "   Replace this:"
echo '     "features": {'
echo '       "ghcr.io/devcontainers/features/docker-in-docker:2": {}'
echo '     }'
echo ""
echo "   With this:"
echo '     "features": {'
echo '       "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {'
echo '         "enableNonRootDocker": true'
echo '       }'
echo '     },'
echo '     "runArgs": ["--network=dev-network"],'
echo '     "containerEnv": {'
echo '       "MCP_API_KEY": "${localEnv:MCP_API_KEY}"'
echo '     }'
echo ""
echo "2. Create .devcontainer/setup-utility-containers.sh:"
echo "   (Downloads agent files inside devcontainer)"
echo ""
echo "   See: docs/DEVCONTAINER_INTEGRATION.md for full example"
echo "   Or run: scripts/setup-for-devcontainer.sh (generates all files)"
echo ""
echo "3. Rebuild your devcontainer:"
echo "   - Open project in VS Code"
echo "   - Ctrl+Shift+P → 'Dev Containers: Rebuild Container'"
echo ""
echo "4. Verify inside devcontainer:"
echo "   docker ps"
echo "   curl http://diagram-converter:3000/health"
echo "   curl http://confluence-mcp:3001/health"
echo ""
echo "📖 Full documentation: docs/DEVCONTAINER_INTEGRATION.md"
echo ""
echo "🔑 Your MCP_API_KEY is in .env file (don't commit to git!)"
echo ""
