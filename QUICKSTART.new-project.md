# Quick Start - New Project Setup

Set up diagram conversion and Confluence publishing in a brand new project with zero configuration.

## Prerequisites

- Docker installed
- Your project folder (can be empty)
- Internet connection

## 3-Minute Setup

### Step 1: Create Docker Network (if not exists)

```bash
# Create shared network (only needed once on your machine)
docker network create dev-network 2>/dev/null || echo "Network already exists"
```

### Step 2: Start Services

```bash
# Pull and start diagram converter (no configuration needed)
docker run -d \
  --name diagram-converter \
  --network dev-network \
  -p 3000:3000 \
  --restart unless-stopped \
  sandhaaland/diagram-converter:latest

# Generate API key for MCP server
MCP_API_KEY=$(openssl rand -hex 32)
echo "Your MCP_API_KEY: $MCP_API_KEY"
echo ""
echo "⚠️  SAVE THIS KEY - You'll need it for VS Code configuration"
echo ""

# Start Confluence MCP server
docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p 3001:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  --restart unless-stopped \
  sandhaaland/confluence-mcp:latest
```

### Step 3: Verify Services

```bash
# Check both services are running
curl http://localhost:3000/health
curl http://localhost:3001/health

# Both should return: {"status":"ok"}
```

### Step 4: Configure VS Code (One-Time Setup)

#### A. Get Agent Definitions (for AI assistance)

```bash
# Create .vscode directory in your project
mkdir -p .vscode

# Download agent definitions
curl http://localhost:3000/agent > .vscode/diagram-agent.agent.md
curl http://localhost:3001/agent > .vscode/confluence-agent.agent.md

echo "✅ VS Code agents configured!"
```

#### B. Configure MCP Server (for Confluence tools)

**Option 1: Automatic Configuration**

```bash
# Get full setup guide
curl http://localhost:3001/mcp/vscode > .vscode/mcp-setup-guide.md

# Open the guide and follow instructions
cat .vscode/mcp-setup-guide.md
```

**Option 2: Manual Configuration**

Add this to `.vscode/settings.json` (create if it doesn't exist):

```json
{
  "mcp": {
    "servers": {
      "confluence": {
        "url": "http://localhost:3001/mcp",
        "transport": { "type": "sse" },
        "headers": { "x-mcp-api-key": "PASTE-YOUR-API-KEY-HERE" },
        "description": "Confluence MCP"
      }
    }
  }
}
```

Replace `PASTE-YOUR-API-KEY-HERE` with the API key from Step 2.

### Step 5: Reload VS Code

```
1. Press Ctrl+Shift+P (or Cmd+Shift+P on macOS)
2. Type "Reload Window" and press Enter
```

## ✅ You're Ready!

Your project now has:

### VS Code Agents Available
- **@diagram-converter** - Convert SVG and Mermaid diagrams to PNG
- **@confluence-publisher** - Publish documentation to Confluence

### MCP Tools Available
Use Command Palette (Ctrl+Shift+P) → "MCP: Execute Tool" → "confluence":
- `confluence_setup_project` - Configure Confluence credentials
- `confluence_test_connection` - Test connection
- `confluence_list_spaces` - List spaces
- `confluence_create_page` - Create page from Markdown
- `confluence_update_page` - Update existing page
- And more...

### Service Endpoints
- **Diagram converter**: http://localhost:3000
- **Confluence MCP**: http://localhost:3001

## Usage Examples

### Convert Diagrams

**Using the agent:**
```
@diagram-converter convert all diagrams in docs/ folder
```

**Using curl:**
```bash
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@diagram.svg" \
  -o diagram.png
```

### Publish to Confluence

**First time setup:**
```
1. Press Ctrl+Shift+P
2. Type "MCP: Execute Tool"
3. Select "confluence" server
4. Choose "confluence_setup_project"
5. Enter your Confluence URL, username, and API token
```

**Then publish:**
```
@confluence-publisher publish README.md to Confluence
```

## Project-Specific Setup (Optional)

If you want project-specific containers (e.g., different ports or Confluence instances):

```bash
# Use different port and unique name
docker run -d \
  --name myproject-confluence-mcp \
  --network dev-network \
  -p 3002:3001 \
  -e MCP_API_KEY="$(openssl rand -hex 32)" \
  -e CONFLUENCE_BASE_URL="https://mycompany.atlassian.net" \
  -e CONFLUENCE_USERNAME="user@company.com" \
  -e CONFLUENCE_API_TOKEN="your-token" \
  --restart unless-stopped \
  sandhaaland/confluence-mcp:latest
```

Then configure VS Code to use the project-specific server:
```bash
curl http://localhost:3002/mcp/vscode?project=myproject > .vscode/mcp-config.md
```

## DevContainer Setup (Recommended: Docker-Outside-of-Docker)

For projects using Dev Containers, **run containers on the Docker host** to avoid duplication and resource waste.

### Why Docker-Outside-of-Docker?

**Docker-in-Docker Problems:**
- ❌ Images downloaded twice (host + devcontainer's Docker daemon)
- ❌ Containers disappear when devcontainer rebuilds
- ❌ Doubled resource usage and storage
- ❌ Complex nested Docker configuration

**Docker-Outside-of-Docker Benefits:**
- ✅ Images downloaded only once (on host)
- ✅ Containers persist across devcontainer rebuilds
- ✅ Shared between host and all devcontainers
- ✅ No Docker-in-Docker overhead
- ✅ Simpler configuration

### Approach A: Start Containers on Host (Recommended)

This approach starts containers on the Docker host before opening the devcontainer.

#### Step 1: Update `.devcontainer/devcontainer.json`

```json
{
  "name": "My Project",
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
```

#### Step 2: Create `.devcontainer/start-utility-containers.sh` (Run from HOST)

```bash
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
```

Make it executable:
```bash
chmod +x .devcontainer/start-utility-containers.sh
```

#### Step 3: Create `.devcontainer/setup-utility-containers.sh` (Runs INSIDE devcontainer)

```bash
#!/bin/bash
# Download agent definitions inside devcontainer
set -e

echo "📥 Downloading VS Code agent definitions..."

mkdir -p .vscode

# Use container names (not localhost) since we're on dev-network
curl -s http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl -s http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md

echo "✅ Agents configured!"
echo ""
echo "🎯 Available services:"
echo "   - diagram-converter: http://diagram-converter:3000"
echo "   - confluence-mcp: http://confluence-mcp:3001"
echo ""
echo "💡 Test connectivity:"
echo "   curl http://diagram-converter:3000/health"
echo "   curl http://confluence-mcp:3001/health"
```

Make it executable:
```bash
chmod +x .devcontainer/setup-utility-containers.sh
```

#### Step 4: Update `.gitignore`

```gitignore
# Environment variables (contains API keys)
.env

# VS Code agent definitions (auto-generated)
.vscode/*.agent.md
```

#### Workflow

1. **From WSL2/host**: `bash .devcontainer/start-utility-containers.sh`
2. **Open project** in VS Code - it will build/start devcontainer
3. **Devcontainer connects** to existing containers via `dev-network`
4. **Agent files download** automatically via `postCreateCommand`

#### Verification

After opening in devcontainer, verify connectivity:

```bash
# From inside devcontainer terminal
docker ps | grep -E 'diagram-converter|confluence-mcp'
curl http://diagram-converter:3000/health
curl http://confluence-mcp:3001/health
```

### Approach B: Docker-in-Docker (Legacy/Alternative)

⚠️ **Not recommended** - This approach downloads images twice and containers are lost on rebuild.

If you still want to use Docker-in-Docker (e.g., for air-gapped environments):

#### `.devcontainer/devcontainer.json`

```json
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",

  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {
      "version": "latest"
    }
  },

  "postCreateCommand": "bash .devcontainer/setup-services-dind.sh",

  "forwardPorts": [3000, 3001],

  "customizations": {
    "vscode": {
      "settings": {
        "mcp": {
          "servers": {
            "confluence": {
              "url": "http://localhost:3001/mcp",
              "transport": { "type": "sse" },
              "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" }
            }
          }
        }
      }
    }
  }
}
```

#### `.devcontainer/setup-services-dind.sh`

```bash
#!/bin/bash
set -e

echo "⚠️  Using Docker-in-Docker (images will download inside devcontainer)"

# Create network inside devcontainer's Docker
docker network create dev-network 2>/dev/null || true

# Generate API key
MCP_API_KEY=$(openssl rand -hex 32)
export MCP_API_KEY

# Start containers inside devcontainer
docker run -d \
  --name diagram-converter \
  --network dev-network \
  -p 3000:3000 \
  sandhaaland/diagram-converter:latest

docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p 3001:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  sandhaaland/confluence-mcp:latest

# Download agents
mkdir -p .vscode
curl http://localhost:3000/agent > .vscode/diagram-agent.agent.md
curl http://localhost:3001/agent > .vscode/confluence-agent.agent.md

echo "✅ Setup complete (Docker-in-Docker mode)"
```

**Note:** With this approach, every time you rebuild the devcontainer, you'll need to re-download images and lose container data.

## Environment Variables

For easier management, create a `.env` file in your project:

```bash
# Confluence MCP Configuration
MCP_API_KEY=your-generated-api-key-here

# Optional: Pre-configure Confluence (for single instance)
# CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
# CONFLUENCE_USERNAME=your-email@company.com
# CONFLUENCE_API_TOKEN=your-confluence-api-token

# Service Ports (if using project-specific containers)
# CONFLUENCE_MCP_PORT=3002
```

Then reference in docker run:
```bash
# Load environment variables
source .env

# Start with environment variables
docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p ${CONFLUENCE_MCP_PORT:-3001}:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  -e CONFLUENCE_BASE_URL="$CONFLUENCE_BASE_URL" \
  -e CONFLUENCE_USERNAME="$CONFLUENCE_USERNAME" \
  -e CONFLUENCE_API_TOKEN="$CONFLUENCE_API_TOKEN" \
  --restart unless-stopped \
  sandhaaland/confluence-mcp:latest
```

## Troubleshooting

### Services not accessible?

```bash
# Check if services are running
docker ps | grep -E "diagram-converter|confluence-mcp"

# Check logs
docker logs diagram-converter
docker logs confluence-mcp

# Test connectivity
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### VS Code agents not appearing?

1. Check agent files exist:
   ```bash
   ls -la .vscode/*.agent.md
   ```

2. Verify YAML frontmatter is valid:
   ```bash
   head -10 .vscode/diagram-agent.agent.md
   ```

3. Restart VS Code completely (not just reload window)

### MCP server not connecting?

1. Check API key matches:
   ```bash
   # In terminal where you started the container
   echo $MCP_API_KEY
   
   # In VS Code settings.json
   # Verify the x-mcp-api-key value matches
   ```

2. Test MCP endpoint:
   ```bash
   curl -H "x-mcp-api-key: YOUR-API-KEY" http://localhost:3001/mcp
   ```

3. Check VS Code has MCP extension installed

### From DevContainer: "Could not resolve host"

Ensure services are on the same network:
```bash
# Check network
docker network inspect dev-network

# Verify containers are connected
docker inspect diagram-converter | grep NetworkMode
docker inspect confluence-mcp | grep NetworkMode
```

## Stop Services

When you're done:

```bash
# Stop containers
docker stop diagram-converter confluence-mcp

# Remove containers
docker rm diagram-converter confluence-mcp

# Optional: Remove network (if not used by other projects)
docker network rm dev-network
```

## Next Steps

1. **Configure Confluence**: Run `confluence_setup_project` tool with your credentials
2. **Test conversion**: `@diagram-converter convert test.svg`
3. **Publish docs**: `@confluence-publisher publish README.md`
4. **Explore tools**: Press Ctrl+Shift+P → "MCP: Execute Tool"

## Advanced: Docker Compose (Optional)

For recurring use, create `docker-compose.yml` in your project:

```yaml
version: '3.8'

services:
  diagram-converter:
    image: sandhaaland/diagram-converter:latest
    container_name: diagram-converter
    ports:
      - "3000:3000"
    networks:
      - dev-network
    restart: unless-stopped

  confluence-mcp:
    image: sandhaaland/confluence-mcp:latest
    container_name: confluence-mcp
    ports:
      - "3001:3001"
    environment:
      - MCP_API_KEY=${MCP_API_KEY}
      - CONFLUENCE_BASE_URL=${CONFLUENCE_BASE_URL:-}
      - CONFLUENCE_USERNAME=${CONFLUENCE_USERNAME:-}
      - CONFLUENCE_API_TOKEN=${CONFLUENCE_API_TOKEN:-}
    networks:
      - dev-network
    restart: unless-stopped

networks:
  dev-network:
    external: true
```

Then just:
```bash
docker compose up -d
```

## Summary

✅ **2 commands** to start services  
✅ **2 curl commands** to get VS Code agents  
✅ **1 settings change** for MCP server  
✅ **Ready to use** in 3 minutes  

No configuration files needed in your project - just the containers and VS Code setup!

**Questions?** Check the full documentation at:
- Main README: [README.md](README.md)
- MCP Configuration: [docs/MCP_VSCODE_CONFIG.md](docs/MCP_VSCODE_CONFIG.md)
- Agent Endpoints: [docs/AGENT_ENDPOINTS.md](docs/AGENT_ENDPOINTS.md)

Enjoy your automated diagram conversion and Confluence publishing! 🚀
