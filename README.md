# Docker Utility Services

A complete containerized solution for document conversion, diagram processing, and Confluence publishing.

## 📋 What This Provides

- **Diagram Converter Service**: HTTP API for converting SVG and Mermaid diagrams to PNG (Node.js 20)
- **Confluence MCP Server**: Model Context Protocol server for AI-powered Confluence publishing (Node.js 20)
- **Pandoc MCP Server**: Model Context Protocol server for document format conversion (Node.js 20 + Pandoc)
- **Generic Mode**: Use with multiple Confluence instances without hardcoded credentials
- **Docker Network**: Shared `dev-network` for cross-project container communication
- **Multi-Project Support**: Run multiple instances with unique container names
- **Helper Scripts**: Utilities for testing and conversion
- **VS Code Integration**: Ready for devcontainer usage with custom agents

## 🚀 Quick Start

### Prerequisites

- WSL2 Ubuntu 24.04
- Docker CLI installed (not Docker Desktop)
- Git (for cloning confluence-mcp)
- curl and jq (for testing)

### Installation Steps

```bash
# 1. Extract this project to your home directory
cd ~
unzip docker-diagram-services.zip
cd docker-diagram-services

# 2. Make scripts executable
chmod +x setup.sh
chmod +x scripts/*.sh

# 3. Run the setup script
./setup.sh

# 4. Follow the prompts to configure Confluence credentials
```

## 📁 Project Structure

```
UtilityContainers/
├── README.md                          # This file
├── setup.sh                           # Automated setup script
├── docker-compose.yml                 # Docker Compose configuration
├── .env.example                       # Environment variables template
│
├── diagram-converter/                 # Diagram conversion service
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
│
├── confluence-mcp/                    # Confluence MCP server
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
├── pandoc-mcp/                        # Pandoc MCP server
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
├── scripts/                           # Helper utilities
│   ├── test-services.sh              # Test all services
│   ├── convert-diagram.sh            # Convert single diagram
│   ├── process-markdown.sh           # Process markdown with diagrams
│   └── start-services.sh             # Start all services
│
├── workspace/                         # Shared workspace
│   ├── docs/                         # Your markdown files
│   │   └── example.md
│   └── diagrams/                     # Your diagram files
│       ├── test.svg
│       └── test.mmd
│
└── docs/                             # Documentation
    ├── SETUP.md                      # Detailed setup guide
    ├── USAGE.md                      # Usage examples
    └── TROUBLESHOOTING.md            # Common issues
```

## 🐳 For DevContainer Projects

**Recommended:** Run containers on Docker host to avoid Docker-in-Docker duplication.

### Why Docker-Outside-of-Docker?

When using devcontainers, running utility containers on the **host** (instead of inside the devcontainer) provides:

- ✅ **Images downloaded only once** - No duplicate downloads in devcontainer
- ✅ **Containers persist** - Survive devcontainer rebuilds
- ✅ **Shared resources** - All devcontainers access same containers
- ✅ **No overhead** - Avoid nested Docker complexity
- ✅ **Faster startup** - Devcontainer connects to existing containers

### Quick Start for DevContainers

```bash
# 1. Generate devcontainer configuration (one-time)
./scripts/setup-for-devcontainer.sh

# 2. Start containers on host (before opening in VS Code)
.devcontainer/start-utility-containers.sh

# 3. Open in VS Code
code .

# 4. Click "Reopen in Container" when prompted
# Devcontainer will automatically connect to containers!
```

### What This Does

1. **Creates `.devcontainer/devcontainer.json`** with:
   - `docker-outside-of-docker` feature (shares host's Docker daemon)
   - `--network=dev-network` (joins same network as utility containers)
   - MCP server configuration using container names

2. **Creates `.devcontainer/start-utility-containers.sh`** (runs on host):
   - Creates `dev-network`
   - Generates `MCP_API_KEY` in `.env`
   - Starts `diagram-converter` and `confluence-mcp` containers

3. **Creates `.devcontainer/setup-utility-containers.sh`** (runs inside devcontainer):
   - Downloads agent definitions using container names
   - Verifies connectivity to services

### Network Connectivity

**From inside devcontainer**, use container names:
```bash
curl http://diagram-converter:3000/health
curl http://confluence-mcp:3001/health
```

**From host or other containers**, use `localhost` or container names:
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### Environment Variables

The devcontainer loads `MCP_API_KEY` from host's `.env` file:

```json
"containerEnv": {
  "MCP_API_KEY": "${localEnv:MCP_API_KEY}"
}
```

Then VS Code settings reference it:
```json
"headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" }
```

### Full Documentation

See [docs/DEVCONTAINER_INTEGRATION.md](docs/DEVCONTAINER_INTEGRATION.md) for:
- Detailed architecture explanation
- Troubleshooting container name resolution
- Security considerations
- Advanced configurations
- Migration from Docker-in-Docker

Also see [QUICKSTART.new-project.md - DevContainer Setup](QUICKSTART.new-project.md#devcontainer-setup-recommended-docker-outside-of-docker) for complete setup instructions.

---

## 📖 Step-by-Step Setup

### Step 1: Verify Docker

```bash
# Check Docker is installed
docker --version

# Start Docker if not running
sudo systemctl start docker

# Add your user to docker group (no sudo needed)
sudo usermod -aG docker $USER
newgrp docker

# Test
docker ps
```

### Step 2: Create Docker Network

```bash
# Create custom network for service communication
docker network create dev-network

# Verify
docker network ls | grep dev-network
```

### Step 3: Configure Confluence Credentials

```bash
# Copy environment template
cp .env.example .env

# Edit with your Confluence details
nano .env
```

Required values:
- `CONFLUENCE_BASE_URL`: Your Confluence URL (e.g., https://yourcompany.atlassian.net)
- `CONFLUENCE_USERNAME`: Your email
- `CONFLUENCE_API_TOKEN`: Generate at https://id.atlassian.com/manage-profile/security/api-tokens

### Step 4: Build and Start Services

```bash
# Build all services
docker-compose build

# Start services in background
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 5: Test the Services

```bash
# Run test script
./scripts/test-services.sh

# Test diagram conversion
./scripts/convert-diagram.sh svg workspace/diagrams/test.svg workspace/diagrams/test-output.png

# Test Mermaid conversion
./scripts/convert-diagram.sh mermaid workspace/diagrams/test.mmd workspace/diagrams/test-mermaid-output.png
```

## 🎯 Usage Examples

### Converting Diagrams via HTTP API

```bash
# Convert SVG to PNG
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@workspace/diagrams/architecture.svg" \
  -o workspace/diagrams/architecture.png

# Convert Mermaid to PNG
curl -X POST http://localhost:3000/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  --data-binary "@workspace/diagrams/flow.mmd" \
  -o workspace/diagrams/flow.png
```

### Using with AI Agents (MCP)

Configure your AI assistant to use the MCP server:

```json
{
  "mcpServers": {
    "confluence": {
      "url": "http://localhost:3001/mcp",
      "transport": "sse"
    }
  }
}
```

Then tell your AI: "Convert all diagrams in my markdown file and publish to Confluence"

### Using in VS Code Devcontainers

Add to your `.devcontainer/devcontainer.json`:

```json
{
  "runArgs": ["--network=dev-network"],
  "customizations": {
    "vscode": {
      "settings": {
        "diagramConverter.url": "http://diagram-converter:3000"
      }
    }
  }
}
```

## 🛠️ Management Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose build
docker-compose up -d

# Stop and remove everything
docker-compose down

# View resource usage
docker stats
```

## 🔍 Health Checks

```bash
# Check diagram converter
curl http://localhost:3000/health

# Check Confluence MCP
curl http://localhost:3001/health

# Check Pandoc MCP
curl http://localhost:3002/health
```
curl http://localhost:3001/health
```

## 📚 Documentation

- [Detailed Setup Guide](docs/SETUP.md)
- [Usage Examples](docs/USAGE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🐛 Common Issues

**Containers can't communicate:**
```bash
docker network inspect dev-network
docker-compose restart
```

**Port already in use:**
```bash
sudo lsof -i :3000
# Kill the process or change port in docker-compose.yml
```

**Permission denied:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 🔄 Auto-Start on WSL Boot

```bash
# Add to ~/.bashrc
echo 'cd ~/docker-diagram-services && ./scripts/start-services.sh' >> ~/.bashrc
```

## 🐳 Docker Hub Deployment

Push images to Docker Hub for faster deployment across projects:

```bash
# Login to Docker Hub
docker login

# Tag images
docker tag docker-diagram-services-diagram-converter:latest yourusername/diagram-converter:latest
docker tag docker-diagram-services-confluence-mcp:latest yourusername/confluence-mcp:latest

# Push to registry
docker push yourusername/diagram-converter:latest
docker push yourusername/confluence-mcp:latest
```

**Benefits:**
- Skip 10+ minute builds in new projects
- Consistent images across team/machines
- Pull updates with `docker compose pull`

## 🏗️ Multi-Project Setup

Run the same services across different projects with isolated configurations:

**Project A (project-a/.env):**
```bash
PROJECT_NAME=project-a
CONFLUENCE_BASE_URL=https://company-a.atlassian.net
CONFLUENCE_MCP_PORT=3001
```

**Project B (project-b/.env):**
```bash
PROJECT_NAME=project-b
CONFLUENCE_BASE_URL=https://company-b.atlassian.net
CONFLUENCE_MCP_PORT=3002
```

**Each uses unique container names:**
- `project-a-confluence-mcp` on port 3001
- `project-b-confluence-mcp` on port 3002

Containers communicate via `dev-network` using container names:
```bash
# From Project A's devcontainer
curl http://project-a-confluence-mcp:3001/health

# From Project B's devcontainer  
curl http://project-b-confluence-mcp:3001/health
```

## 📦 Accessing from Windows

Your workspace is accessible from Windows at:
```
\\wsl$\Ubuntu-24.04\home\yourusername\docker-diagram-services\workspace
```

Services are accessible at:
- http://localhost:3000 (Diagram Converter)
- http://localhost:3001 (Confluence MCP)
- http://localhost:3002 (Pandoc MCP)

## 🤝 Contributing

Feel free to modify and extend these services for your needs!

## 📄 License

MIT License - Feel free to use and modify.

## 🆘 Support

Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) or review container logs:
```bash
docker-compose logs diagram-converter
docker-compose logs confluence-mcp
```
