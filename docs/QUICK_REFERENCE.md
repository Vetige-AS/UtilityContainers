# Quick Reference: Devcontainer + Confluence MCP Services

## 🎯 Add to Your Devcontainer

```json
{
  "runArgs": ["--network=dev-network"]
}
```

That's it! Now you have access to both services.

## 📡 Service URLs (from devcontainer)

```bash
http://diagram-converter:3000    # Convert diagrams
http://confluence-mcp:3001        # Confluence MCP server
```

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

## 🔐 MCP Authentication

Add to your devcontainer `.env` or config:
```bash
MCP_API_KEY=your-generated-key
```

## 📝 Full Documentation

- **Devcontainer Setup**: [docs/DEVCONTAINER_USAGE.md](DEVCONTAINER_USAGE.md)
- **Generic Mode**: [docs/GENERIC_MODE.md](GENERIC_MODE.md)
- **General Usage**: [docs/USAGE.md](USAGE.md)

## ✅ Verify Setup

From inside your devcontainer:

```bash
# Test network connectivity
ping diagram-converter
ping confluence-mcp

# Test services
curl http://diagram-converter:3000/health
curl http://confluence-mcp:3001/health
```

## 🚀 Start Services (from host)

```bash
cd /home/per/code/docker-diagram-services
docker compose up -d
```

## 🔄 Manage Services (from host)

```bash
# View status
docker compose ps

# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose stop
```

## 💡 Pro Tips

1. **Services persist** - They keep running even if you rebuild your devcontainer
2. **Shared across projects** - All devcontainers on `dev-network` can access them
3. **Generic mode** - Each devcontainer can configure different Confluence instances
4. **No port conflicts** - Services use internal container networking

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

### 3. Multiple Confluence instances
```bash
# Devcontainer A - Client 1
export CONFLUENCE_BASE_URL=https://client1.atlassian.net

# Devcontainer B - Client 2
export CONFLUENCE_BASE_URL=https://client2.atlassian.net
```
