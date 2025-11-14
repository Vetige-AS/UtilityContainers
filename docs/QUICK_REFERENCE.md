# Quick Reference: Devcontainer + UtilityContainers

## 🚀 Two Approaches

### **Recommended: Docker-Outside-of-Docker**
Containers run on host, devcontainer connects to them
- ✅ Images downloaded once
- ✅ Containers persist across rebuilds
- ✅ No duplication

### Alternative: Docker-in-Docker (Legacy)
Containers run inside devcontainer
- ❌ Images downloaded per devcontainer
- ❌ Lost on rebuild

---

## 🎯 Quick Setup (Docker-Outside-of-Docker)

### 1. Generate Configuration Files
```bash
# Run from your project root
/path/to/UtilityContainers/scripts/setup-for-devcontainer.sh
```

### 2. Start Containers on Host
```bash
# Run BEFORE opening devcontainer
bash .devcontainer/start-utility-containers.sh
```

### 3. Open in VS Code
```bash
code .
# Click "Reopen in Container"
```

That's it! Services will be available inside devcontainer.

---

## 📡 Service URLs

**From inside devcontainer** (use container names):
```bash
http://diagram-converter:3000    # Convert diagrams
http://confluence-mcp:3001        # Confluence MCP server
```

**From host** (use localhost):
```bash
http://localhost:3000             # Diagram converter
http://localhost:3001             # Confluence MCP
```

---

## 🔧 Quick Examples

### Convert Mermaid Diagram
```bash
curl -X POST http://diagram-converter:3000/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  --data-binary "@diagram.mmd" \
  -o diagram.png
```

### Convert SVG
```bash
curl -X POST http://diagram-converter:3000/convert/svg2png \
  -F "file=@diagram.svg" \
  -o diagram.png
```

### Health Check
```bash
curl http://diagram-converter:3000/health
curl http://confluence-mcp:3001/health
```

---

## 🔐 Environment Variables

**Load from host's .env** (automatically via devcontainer.json):
```bash
MCP_API_KEY=your-generated-key
CONFLUENCE_BASE_URL=https://company.atlassian.net
```

**Reference in VS Code settings**:
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

---

## ✅ Verify Setup

From inside your devcontainer:

```bash
# Check Docker connectivity (should show host containers)
docker ps | grep -E 'diagram-converter|confluence-mcp'

# Test network connectivity
curl http://diagram-converter:3000/health
curl http://confluence-mcp:3001/health

# Both should return: {"status":"ok"}
```

---

## 🔄 Manage Services (from host)

```bash
# View status
docker ps | grep -E 'diagram-converter|confluence-mcp'

# View logs
docker logs diagram-converter
docker logs confluence-mcp

# Restart
docker restart diagram-converter confluence-mcp

# Stop
docker stop diagram-converter confluence-mcp
```

---

## 📝 Key Configuration Files

### `.devcontainer/devcontainer.json`
```json
{
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "enableNonRootDocker": true
    }
  },
  "runArgs": ["--network=dev-network"],
  "containerEnv": {
    "MCP_API_KEY": "${localEnv:MCP_API_KEY}"
  }
}
```

### `.env` (on host, DO NOT COMMIT)
```bash
MCP_API_KEY=abc123...
CONFLUENCE_BASE_URL=https://company.atlassian.net
CONFLUENCE_USERNAME=user@company.com
```

---

## 🐛 Troubleshooting

### Container names don't resolve
```bash
# Check devcontainer is on dev-network
docker inspect <devcontainer-id> | grep NetworkMode

# Should show: "NetworkMode": "dev-network"
```

### Containers not running
```bash
# On host, restart containers
docker restart diagram-converter confluence-mcp
```

### MCP authentication fails
```bash
# Verify API key matches
cat .env | grep MCP_API_KEY          # On host
echo $MCP_API_KEY                    # Inside devcontainer

# Should be identical!
```

---

## 💡 Pro Tips

1. **Services persist** - Keep running even if you rebuild devcontainer
2. **Shared across projects** - All devcontainers on `dev-network` access same containers
3. **No port conflicts** - Use container names internally, localhost from host
4. **Generic mode** - Each devcontainer can configure different Confluence instances
5. **One-time image pull** - Images downloaded once on host, not per devcontainer

---

## 📖 Full Documentation

- **DevContainer Integration**: [docs/DEVCONTAINER_INTEGRATION.md](DEVCONTAINER_INTEGRATION.md) - Complete guide
- **Quick Start New Project**: [QUICKSTART.new-project.md](../QUICKSTART.new-project.md) - Step-by-step setup
- **Migration Guide**: Run `scripts/migrate-to-host-docker.sh` - Migrate from Docker-in-Docker
- **Generic Mode**: [docs/GENERIC_MODE.md](GENERIC_MODE.md) - Multiple Confluence instances
- **General Usage**: [docs/USAGE.md](USAGE.md) - API examples

---

## 🎨 Example Use Cases

### 1. Auto-convert diagrams in CI/CD
```bash
for file in docs/**/*.mmd; do
  curl -X POST http://diagram-converter:3000/convert/mermaid2png \
    --data-binary "@$file" \
    -o "${file%.mmd}.png"
done
```

### 2. Publish docs to Confluence from devcontainer
```python
import requests
import os

response = requests.post(
    'http://confluence-mcp:3001/mcp',
    headers={'x-mcp-api-key': os.getenv('MCP_API_KEY')},
    json={
        'jsonrpc': '2.0',
        'method': 'tools/call',
        'params': {
            'name': 'confluence_create_page',
            'arguments': {
                'title': 'API Documentation',
                'markdownContent': open('README.md').read(),
                'spaceKey': 'DOCS'
            }
        }
    }
)
```

### 3. Download agent definitions automatically
```bash
#!/bin/bash
# .devcontainer/setup-utility-containers.sh
mkdir -p .vscode
curl -s http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl -s http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md
```

---

## 🔄 Migration from Docker-in-Docker

```bash
# Run migration script
./scripts/migrate-to-host-docker.sh

# Then rebuild devcontainer
# Ctrl+Shift+P → "Dev Containers: Rebuild Container"
```
