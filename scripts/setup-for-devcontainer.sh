#!/bin/bash
# Generate devcontainer configuration for UtilityContainers integration
# This script creates all necessary files for docker-outside-of-docker setup

set -e

echo "🔧 Setting up DevContainer integration for UtilityContainers..."
echo ""

# Create .devcontainer directory if it doesn't exist
mkdir -p .devcontainer
mkdir -p .vscode

# Create start-utility-containers.sh (runs on HOST)
cat > .devcontainer/start-utility-containers.sh << 'EOF'
#!/bin/bash
# Start UtilityContainers on Docker host BEFORE opening devcontainer
set -e

echo "🚀 Starting UtilityContainers on Docker host..."

# Create network
docker network create dev-network 2>/dev/null || echo "✅ Network dev-network already exists"

# Generate API key if .env doesn't exist
if [ ! -f .env ]; then
    MCP_API_KEY=$(openssl rand -hex 32)
    echo "MCP_API_KEY=$MCP_API_KEY" > .env
    echo "✅ Generated MCP_API_KEY: $MCP_API_KEY"
    echo ""
    echo "⚠️  SAVE THIS KEY - It's now in .env file"
else
    echo "✅ Using existing .env file"
fi

# Load environment variables
source .env

# Start containers
echo "📦 Starting diagram-converter..."
docker run -d \
  --name diagram-converter \
  --network dev-network \
  -p 3000:3000 \
  --restart unless-stopped \
  sandhaaland/diagram-converter:latest 2>/dev/null || echo "✅ diagram-converter already running"

echo "📦 Starting confluence-mcp..."
docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p 3001:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  --restart unless-stopped \
  sandhaaland/confluence-mcp:latest 2>/dev/null || echo "✅ confluence-mcp already running"

echo ""
echo "✅ Containers running on host!"
echo ""
echo "📋 Next steps:"
echo "   1. Open this project in VS Code"
echo "   2. When prompted, click 'Reopen in Container'"
echo "   3. Devcontainer will connect to these containers"
echo ""
echo "🔍 Verify containers:"
echo "   docker ps | grep -E 'diagram-converter|confluence-mcp'"
EOF

# Create setup-utility-containers.sh (runs INSIDE devcontainer)
cat > .devcontainer/setup-utility-containers.sh << 'EOF'
#!/bin/bash
# Download agent definitions inside devcontainer
set -e

echo "📥 Downloading VS Code agent definitions..."

mkdir -p .vscode

# Wait for containers to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Use container names (not localhost) since we're on dev-network
echo "📥 Downloading diagram-converter agent..."
curl -s http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md || {
    echo "❌ Failed to download diagram-converter agent"
    echo "   Check if containers are running: docker ps"
    exit 1
}

echo "📥 Downloading confluence-mcp agent..."
curl -s http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md || {
    echo "❌ Failed to download confluence-mcp agent"
    echo "   Check if containers are running: docker ps"
    exit 1
}

echo "✅ Agents configured!"
echo ""
echo "🎯 Available services:"
echo "   - diagram-converter: http://diagram-converter:3000"
echo "   - confluence-mcp: http://confluence-mcp:3001"
echo ""
echo "💡 Test connectivity:"
echo "   curl http://diagram-converter:3000/health"
echo "   curl http://confluence-mcp:3001/health"
EOF

# Make scripts executable
chmod +x .devcontainer/start-utility-containers.sh
chmod +x .devcontainer/setup-utility-containers.sh

# Create devcontainer.json template
cat > .devcontainer/devcontainer.json << 'EOF'
{
  "name": "My Project with UtilityContainers",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",

  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "version": "latest",
      "enableNonRootDocker": true
    }
  },

  "runArgs": [
    "--network=dev-network"
  ],

  "forwardPorts": [3000, 3001],

  "postCreateCommand": "bash .devcontainer/setup-utility-containers.sh",

  "containerEnv": {
    "MCP_API_KEY": "${localEnv:MCP_API_KEY}"
  },

  "customizations": {
    "vscode": {
      "settings": {
        "mcp": {
          "servers": {
            "confluence": {
              "url": "http://confluence-mcp:3001/mcp",
              "transport": { "type": "sse" },
              "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" },
              "description": "Confluence MCP"
            }
          }
        }
      }
    }
  }
}
EOF

# Update .gitignore
if [ -f .gitignore ]; then
    echo "" >> .gitignore
    echo "# UtilityContainers" >> .gitignore
    echo ".env" >> .gitignore
    echo ".vscode/*.agent.md" >> .gitignore
    echo "✅ Updated .gitignore"
else
    cat > .gitignore << 'EOF'
# UtilityContainers
.env
.vscode/*.agent.md
EOF
    echo "✅ Created .gitignore"
fi

echo ""
echo "✅ DevContainer scripts created!"
echo ""
echo "📁 Files created:"
echo "   - .devcontainer/devcontainer.json"
echo "   - .devcontainer/start-utility-containers.sh"
echo "   - .devcontainer/setup-utility-containers.sh"
echo "   - .gitignore (updated)"
echo ""
echo "📋 Next steps:"
echo ""
echo "   1. Review and customize .devcontainer/devcontainer.json"
echo "      (Change base image, add features, etc.)"
echo ""
echo "   2. From your HOST (WSL2/native Docker), run:"
echo "      bash .devcontainer/start-utility-containers.sh"
echo ""
echo "   3. Open project in VS Code and click 'Reopen in Container'"
echo ""
echo "   4. Devcontainer will automatically:"
echo "      - Connect to host's Docker daemon"
echo "      - Join dev-network with utility containers"
echo "      - Download agent definitions"
echo ""
echo "💡 Tip: Commit .devcontainer/ files to your repository"
echo "    so team members get the same setup!"
echo ""
