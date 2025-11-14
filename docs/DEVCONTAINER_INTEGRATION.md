# DevContainer Integration Guide

Complete guide for integrating UtilityContainers with VS Code Dev Containers using the docker-outside-of-docker pattern.

## Table of Contents

- [Overview](#overview)
- [Why Docker-Outside-of-Docker?](#why-docker-outside-of-docker)
- [Architecture](#architecture)
- [Setup Guide](#setup-guide)
- [Network Configuration](#network-configuration)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Advanced Configurations](#advanced-configurations)
- [Migration Guide](#migration-guide)

## Overview

UtilityContainers provides diagram conversion and Confluence publishing services that can be shared across multiple projects. When using VS Code Dev Containers, the recommended approach is to run these utility containers on the **Docker host** and have devcontainers connect to them via a shared Docker network.

### Key Benefits

✅ **Resource Efficiency**: Images downloaded once on host, not per-devcontainer  
✅ **Persistence**: Containers survive devcontainer rebuilds  
✅ **Shared Services**: Multiple devcontainers can use same containers  
✅ **Simplified Management**: Start containers once, use everywhere  
✅ **Faster Development**: No waiting for image pulls on rebuild  

## Why Docker-Outside-of-Docker?

### Docker-in-Docker Problems

The traditional Docker-in-Docker (DinD) approach has significant drawbacks:

| Issue | Impact |
|-------|--------|
| **Duplicate Images** | Same images downloaded in host + each devcontainer (~2-3GB wasted per devcontainer) |
| **Lost Containers** | Containers deleted when devcontainer rebuilds |
| **Resource Overhead** | Nested Docker daemon consumes extra CPU/memory |
| **Complexity** | Complex privileged container configuration |
| **Isolation Issues** | Containers can't communicate across devcontainers |

### Docker-Outside-of-Docker Solution

Instead of running Docker **inside** the devcontainer, mount the host's Docker socket:

```
┌─────────────────────────────────────────────────┐
│                  Docker Host                    │
│  ┌──────────────┐  ┌──────────────────────┐    │
│  │ Dev Container│  │ Utility Containers   │    │
│  │              │  │ - diagram-converter  │    │
│  │ (your code)  │  │ - confluence-mcp     │    │
│  │              │  │                      │    │
│  │ Docker CLI ──┼──► Uses host's Docker  │    │
│  └──────────────┘  └──────────────────────┘    │
│         │                                       │
│         └──────► /var/run/docker.sock          │
└─────────────────────────────────────────────────┘
```

**How it works:**
1. Devcontainer mounts host's Docker socket (`/var/run/docker.sock`)
2. Docker CLI inside devcontainer talks to host's Docker daemon
3. All containers (dev + utility) run on same host
4. Devcontainer joins `dev-network` to communicate with utility containers

## Architecture

### Network Topology

```
┌──────────────────────────────────────────────────────────┐
│                      dev-network                         │
│                                                           │
│  ┌──────────────────┐  ┌───────────────────────────┐    │
│  │  Your DevContainer│  │  diagram-converter:3000  │    │
│  │                  │  │                           │    │
│  │  Code, tools,    │  │  Converts SVG/Mermaid     │    │
│  │  environment     │  │  to PNG                   │    │
│  │                  │  │                           │    │
│  │  http://diagram-─┼──►  /convert/svg2png        │    │
│  │    converter:3000│  └───────────────────────────┘    │
│  │                  │                                    │
│  │                  │  ┌───────────────────────────┐    │
│  │  http://conflu-──┼──►  confluence-mcp:3001     │    │
│  │    ence-mcp:3001 │  │                           │    │
│  │                  │  │  MCP Server for           │    │
│  └──────────────────┘  │  Confluence publishing    │    │
│                        │                           │    │
│                        │  /mcp endpoint            │    │
│                        └───────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
         │                        │                  │
         │                        │                  │
         └────────────────────────┴──────────────────┘
                   Port forwarding to host
                   localhost:3000, localhost:3001
```

### Container Name Resolution

On `dev-network`, containers can resolve each other by name:

```bash
# From inside devcontainer
curl http://diagram-converter:3000/health     # ✅ Works
curl http://confluence-mcp:3001/health        # ✅ Works
curl http://localhost:3000/health              # ✅ Also works (port forwarded)
```

**From host:**
```bash
# Host can use localhost or container names
curl http://localhost:3000/health              # ✅ Works
curl http://diagram-converter:3000/health      # ✅ Works (if host is also on network)
```

## Setup Guide

### Automated Setup (Recommended)

Use the provided setup script to generate all necessary files:

```bash
# From your project root
cd /path/to/your/project

# Run setup script from UtilityContainers repo
/path/to/UtilityContainers/scripts/setup-for-devcontainer.sh
```

This creates:
- `.devcontainer/devcontainer.json` - DevContainer configuration
- `.devcontainer/start-utility-containers.sh` - Host-side startup script
- `.devcontainer/setup-utility-containers.sh` - Devcontainer-side setup script
- `.gitignore` updates - Ignore `.env` and generated agent files

### Manual Setup

#### 1. Create `.devcontainer/devcontainer.json`

```json
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
              "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" }
            }
          }
        }
      }
    }
  }
}
```

**Key settings explained:**

- **`docker-outside-of-docker` feature**: Mounts host's Docker socket instead of running nested Docker daemon
- **`enableNonRootDocker: true`**: Allows non-root user to use Docker CLI
- **`--network=dev-network`**: Joins the same network as utility containers
- **`forwardPorts`**: Exposes container ports to host (optional, for convenience)
- **`containerEnv`**: Loads environment variables from host
- **`postCreateCommand`**: Runs setup script when devcontainer is created

#### 2. Create `.devcontainer/start-utility-containers.sh`

This script runs on the **host** before opening the devcontainer:

```bash
#!/bin/bash
set -e

echo "🚀 Starting UtilityContainers on Docker host..."

# Create network
docker network create dev-network 2>/dev/null || echo "✅ Network exists"

# Generate API key
if [ ! -f .env ]; then
    MCP_API_KEY=$(openssl rand -hex 32)
    echo "MCP_API_KEY=$MCP_API_KEY" > .env
    echo "✅ Generated MCP_API_KEY"
fi

source .env

# Start containers
docker run -d \
  --name diagram-converter \
  --network dev-network \
  -p 3000:3000 \
  --restart unless-stopped \
  sandhaaland/diagram-converter:latest 2>/dev/null || echo "✅ Already running"

docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p 3001:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  --restart unless-stopped \
  sandhaaland/confluence-mcp:latest 2>/dev/null || echo "✅ Already running"

echo "✅ Containers running! Now open in VS Code."
```

Make executable:
```bash
chmod +x .devcontainer/start-utility-containers.sh
```

#### 3. Create `.devcontainer/setup-utility-containers.sh`

This script runs **inside** the devcontainer during `postCreateCommand`:

```bash
#!/bin/bash
set -e

echo "📥 Downloading VS Code agent definitions..."

mkdir -p .vscode

# Use container names (not localhost)
curl -s http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl -s http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md

echo "✅ Agents configured!"
```

Make executable:
```bash
chmod +x .devcontainer/setup-utility-containers.sh
```

### Workflow

1. **On host**: `bash .devcontainer/start-utility-containers.sh`
2. **Open in VS Code**: `code .`
3. **Click "Reopen in Container"**
4. Devcontainer builds and runs `postCreateCommand`
5. Start coding with agents available!

## Network Configuration

### Creating the Network

The `dev-network` is an external Docker network that containers join:

```bash
# Create once on your machine
docker network create dev-network
```

**Properties:**
- **Bridge network**: Default driver, allows container-to-container communication
- **DNS resolution**: Containers resolve each other by name
- **Isolation**: Containers not on this network can't communicate
- **Persistent**: Survives container restarts

### Joining the Network

**Utility containers** join via `--network` flag:
```bash
docker run --network dev-network ...
```

**Devcontainer** joins via `runArgs`:
```json
"runArgs": ["--network=dev-network"]
```

### Verifying Network Connectivity

From inside devcontainer:

```bash
# List all containers on network
docker network inspect dev-network

# Test DNS resolution
nslookup diagram-converter
nslookup confluence-mcp

# Test HTTP connectivity
curl http://diagram-converter:3000/health
curl http://confluence-mcp:3001/health

# Expected response: {"status":"ok"}
```

## Environment Variables

### Loading from Host

The devcontainer can access environment variables from the host's `.env` file:

**`.env` file on host:**
```bash
MCP_API_KEY=abc123...
CONFLUENCE_BASE_URL=https://mycompany.atlassian.net
CONFLUENCE_USERNAME=user@company.com
```

**`devcontainer.json`:**
```json
"containerEnv": {
  "MCP_API_KEY": "${localEnv:MCP_API_KEY}",
  "CONFLUENCE_BASE_URL": "${localEnv:CONFLUENCE_BASE_URL}",
  "CONFLUENCE_USERNAME": "${localEnv:CONFLUENCE_USERNAME}"
}
```

**Inside devcontainer:**
```bash
echo $MCP_API_KEY          # Prints: abc123...
```

### Using in VS Code Settings

Reference environment variables in VS Code settings using `${env:VAR_NAME}`:

```json
{
  "mcp": {
    "servers": {
      "confluence": {
        "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" }
      }
    }
  }
}
```

### Security Best Practices

1. **Never commit `.env` to git**:
   ```gitignore
   .env
   ```

2. **Use `.env.example` for documentation**:
   ```bash
   # .env.example
   MCP_API_KEY=generate-with-openssl-rand-hex-32
   CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
   ```

3. **Generate keys securely**:
   ```bash
   openssl rand -hex 32
   ```

## Troubleshooting

### Container Names Don't Resolve

**Symptom:** `curl: (6) Could not resolve host: diagram-converter`

**Causes & Solutions:**

1. **Not on same network**
   ```bash
   # Check devcontainer is on dev-network
   docker inspect <devcontainer-id> | grep NetworkMode
   
   # Should show: "NetworkMode": "dev-network"
   ```

2. **Network doesn't exist**
   ```bash
   docker network create dev-network
   ```

3. **Containers not on network**
   ```bash
   # Check which containers are on network
   docker network inspect dev-network
   
   # Should list diagram-converter and confluence-mcp
   ```

4. **DNS not configured**
   ```bash
   # Inside devcontainer, check /etc/resolv.conf
   cat /etc/resolv.conf
   
   # Should have Docker's DNS server (127.0.0.11)
   ```

### Containers Not Running

**Symptom:** `curl: (7) Failed to connect to diagram-converter port 3000`

**Check container status:**
```bash
docker ps | grep -E 'diagram-converter|confluence-mcp'
```

**Check logs:**
```bash
docker logs diagram-converter
docker logs confluence-mcp
```

**Restart containers:**
```bash
docker restart diagram-converter confluence-mcp
```

### MCP Authentication Fails

**Symptom:** MCP tools return 401 Unauthorized

**Check API key matches:**
```bash
# On host
cat .env | grep MCP_API_KEY

# Inside devcontainer
echo $MCP_API_KEY

# These should match!
```

**Reload devcontainer to refresh environment:**
1. Ctrl+Shift+P → "Dev Containers: Rebuild Container"

### Port Already in Use

**Symptom:** `Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use`

**Find what's using the port:**
```bash
sudo lsof -i :3000
```

**Options:**
1. Stop the other service
2. Change port in docker run command: `-p 3002:3000`

### Docker Socket Permission Denied

**Symptom:** `permission denied while trying to connect to the Docker daemon socket`

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker ps
```

## Security Considerations

### Docker Socket Access

Mounting `/var/run/docker.sock` gives the devcontainer **full control** over the host's Docker daemon:

**What this means:**
- Can start/stop/delete any container on host
- Can access volumes and networks
- Can pull images
- Essentially root-level access to Docker

**Mitigations:**
1. **Trust your devcontainer image** - Use official Microsoft devcontainer images
2. **Review Dockerfiles** - Don't blindly trust third-party images
3. **Use read-only mount** (if only viewing containers):
   ```json
   "mounts": [
     "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind,readonly"
   ]
   ```
4. **Consider rootless Docker** on host for extra isolation

### API Key Management

The `MCP_API_KEY` authenticates requests to the Confluence MCP server:

**Best practices:**
1. Generate strong keys: `openssl rand -hex 32`
2. Don't commit to git (use `.gitignore`)
3. Rotate regularly
4. Use different keys for different projects/environments
5. Store securely (e.g., password manager)

### Network Isolation

Containers on `dev-network` can communicate freely:

**Considerations:**
1. Don't put untrusted containers on `dev-network`
2. Use separate networks for different security zones
3. Consider firewall rules if exposing ports to internet

## Advanced Configurations

### Multiple Projects with Project-Specific Containers

Run unique containers per project to avoid conflicts:

**Project A:**
```bash
docker run -d \
  --name projecta-confluence-mcp \
  --network dev-network \
  -p 3002:3001 \
  -e MCP_API_KEY="$PROJECT_A_API_KEY" \
  sandhaaland/confluence-mcp:latest
```

**Project A devcontainer.json:**
```json
{
  "customizations": {
    "vscode": {
      "settings": {
        "mcp": {
          "servers": {
            "confluence": {
              "url": "http://projecta-confluence-mcp:3001/mcp"
            }
          }
        }
      }
    }
  }
}
```

### Using Docker Compose on Host

Instead of `docker run`, use `docker-compose.yml`:

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
    networks:
      - dev-network
    restart: unless-stopped

networks:
  dev-network:
    external: true
```

**Start:**
```bash
docker compose up -d
```

### Custom Base Images

Extend the devcontainer with additional tools:

**`Dockerfile`:**
```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install additional tools
RUN apt-get update && apt-get install -y \
    graphviz \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*
```

**`devcontainer.json`:**
```json
{
  "build": {
    "dockerfile": "Dockerfile"
  },
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {}
  }
}
```

### Health Checks in Setup Script

Add verification before downloading agents:

```bash
#!/bin/bash
set -e

echo "⏳ Waiting for services..."

# Wait for diagram-converter
until curl -sf http://diagram-converter:3000/health > /dev/null; do
    echo "Waiting for diagram-converter..."
    sleep 2
done
echo "✅ diagram-converter ready"

# Wait for confluence-mcp
until curl -sf http://confluence-mcp:3001/health > /dev/null; do
    echo "Waiting for confluence-mcp..."
    sleep 2
done
echo "✅ confluence-mcp ready"

# Now download agents
curl -s http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl -s http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md
```

## Migration Guide

### From Docker-in-Docker to Docker-Outside-of-Docker

If you're currently using Docker-in-Docker, here's how to migrate:

#### Step 1: Backup Current Setup

```bash
# Document running containers
docker ps > containers-backup.txt

# Export any important data
docker export confluence-mcp > confluence-backup.tar
```

#### Step 2: Stop DinD Containers

```bash
# Inside old devcontainer
docker stop diagram-converter confluence-mcp
docker rm diagram-converter confluence-mcp
```

#### Step 3: Update devcontainer.json

**Old (DinD):**
```json
{
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  }
}
```

**New (DooD):**
```json
{
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "enableNonRootDocker": true
    }
  },
  "runArgs": ["--network=dev-network"]
}
```

#### Step 4: Start Containers on Host

```bash
# Exit devcontainer, run on host
bash .devcontainer/start-utility-containers.sh
```

#### Step 5: Rebuild Devcontainer

1. Ctrl+Shift+P → "Dev Containers: Rebuild Container"
2. Wait for rebuild
3. Verify connectivity:
   ```bash
   docker ps
   curl http://diagram-converter:3000/health
   ```

#### Step 6: Clean Up Old Images (Optional)

```bash
# Remove DinD images from host
docker system prune -a
```

### Migration Script

Save as `scripts/migrate-to-host-docker.sh`:

```bash
#!/bin/bash
set -e

echo "🔄 Migrating from Docker-in-Docker to Docker-outside-of-Docker"
echo ""

# Check if inside devcontainer
if [ -f /.dockerenv ]; then
    echo "⚠️  Please run this script from the HOST, not inside devcontainer"
    exit 1
fi

echo "1. Stopping any DinD containers..."
docker stop diagram-converter confluence-mcp 2>/dev/null || true
docker rm diagram-converter confluence-mcp 2>/dev/null || true

echo "2. Creating dev-network..."
docker network create dev-network 2>/dev/null || echo "Network exists"

echo "3. Starting containers on host..."
bash .devcontainer/start-utility-containers.sh

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Open project in VS Code"
echo "  2. Ctrl+Shift+P → 'Dev Containers: Rebuild Container'"
echo "  3. Verify: docker ps | grep -E 'diagram|confluence'"
```

## Minimum Requirements

- **Docker**: 20.10 or later
- **VS Code**: 1.80 or later
- **Dev Containers extension**: 0.300 or later
- **Host OS**: Linux, macOS, or WSL2 on Windows

## Further Reading

- [Dev Containers Features](https://containers.dev/features)
- [Docker Outside of Docker Feature](https://github.com/devcontainers/features/tree/main/src/docker-outside-of-docker)
- [Docker Network Documentation](https://docs.docker.com/network/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Support

For issues specific to UtilityContainers:
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Review container logs: `docker logs <container-name>`
- Verify network: `docker network inspect dev-network`

For devcontainer issues:
- [VS Code Dev Containers Docs](https://code.visualstudio.com/docs/devcontainers/containers)
- [Dev Containers GitHub](https://github.com/microsoft/vscode-dev-containers)
