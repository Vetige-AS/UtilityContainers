# Quick Start - 5 Minutes to Working Setup

Get diagram conversion and Confluence publishing working in your project in 5 minutes.

## Prerequisites

- Docker installed
- Internet connection
- That's it!

## Step 1: Pull the Images (1 minute)

```bash
docker pull manateeit/diagram-converter:latest
docker pull manateeit/confluence-mcp:latest
```

> **Don't have the images yet?** Clone this repo and run `docker compose build` to build them locally.

## Step 2: Create Network (10 seconds)

```bash
docker network create dev-network
```

## Step 3: Start Services (30 seconds)

```bash
# Start diagram converter
docker run -d \
  --name diagram-converter \
  --network dev-network \
  -p 3000:3000 \
  --restart unless-stopped \
  manateeit/diagram-converter:latest

# Generate API key
export MCP_API_KEY=$(openssl rand -hex 32)
echo "MCP_API_KEY=$MCP_API_KEY"

# Start Confluence MCP (save the API key!)
docker run -d \
  --name confluence-mcp \
  --network dev-network \
  -p 3001:3001 \
  -e MCP_API_KEY="$MCP_API_KEY" \
  --restart unless-stopped \
  manateeit/confluence-mcp:latest
```

## Step 4: Configure VS Code (2 minutes)

### Option A: Automatic (Recommended)

```bash
# Get VS Code agent definitions
curl http://localhost:3000/agent > .vscode/diagram-agent.agent.md
curl http://localhost:3001/agent > .vscode/confluence-agent.agent.md

# Get MCP server configuration
curl http://localhost:3001/mcp/vscode > .vscode/mcp-setup-guide.md
```

Then follow the instructions in `.vscode/mcp-setup-guide.md` to add MCP server to VS Code settings.

### Option B: Manual

Add to `.vscode/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "confluence": {
        "url": "http://localhost:3001/mcp",
        "transport": { "type": "sse" },
        "headers": { "x-mcp-api-key": "YOUR-API-KEY-HERE" },
        "description": "Confluence MCP"
      }
    }
  }
}
```

Replace `YOUR-API-KEY-HERE` with the MCP_API_KEY from Step 3.

## Step 5: Verify (1 minute)

```bash
# Check services are running
curl http://localhost:3000/health
curl http://localhost:3001/health

# Both should return: {"status":"ok"}
```

**In VS Code**:
1. Reload window (Ctrl+Shift+P → "Reload Window")
2. You now have:
   - `@diagram-converter` agent
   - `@confluence-publisher` agent
   - MCP server with Confluence tools

## Usage Examples

### Convert Diagrams

**Option 1: Use the agent**
```
@diagram-converter convert all SVG and Mermaid files in docs/diagrams
```

**Option 2: Use curl**
```bash
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@diagram.svg" \
  -o diagram.png
```

### Publish to Confluence

**Option 1: Use the agent**
```
@confluence-publisher publish README.md to Confluence
```

**Option 2: Use MCP tools in VS Code**
1. Open Command Palette (Ctrl+Shift+P)
2. Type "MCP: Execute Tool"
3. Select "confluence"
4. Choose tool (e.g., `confluence_create_page`)

## Multi-Project Setup

Want to use different Confluence instances per project?

```bash
# Project-specific containers
docker run -d \
  --name myproject-confluence-mcp \
  --network dev-network \
  -p 3002:3001 \
  -e MCP_API_KEY="$(openssl rand -hex 32)" \
  -e CONFLUENCE_BASE_URL="https://mycompany.atlassian.net" \
  -e CONFLUENCE_USERNAME="your-email@company.com" \
  -e CONFLUENCE_API_TOKEN="your-api-token" \
  manateeit/confluence-mcp:latest
```

Then fetch project-specific configs:
```bash
curl http://localhost:3002/mcp/vscode?project=myproject > .vscode/mcp-config.md
```

## DevContainer Setup

Add to `.devcontainer/devcontainer.json`:

```json
{
  "name": "My Project",
  "runArgs": ["--network=dev-network"],
  "postCreateCommand": "bash .devcontainer/setup-agents.sh"
}
```

Create `.devcontainer/setup-agents.sh`:
```bash
#!/bin/bash
mkdir -p .vscode
curl http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md
curl http://confluence-mcp:3001/mcp/vscode?devcontainer=true > .vscode/mcp-config.md
echo "✅ Agents configured!"
```

## Troubleshooting

**Services not starting?**
```bash
docker logs diagram-converter
docker logs confluence-mcp
```

**Can't connect from devcontainer?**
```bash
# Check network
docker network inspect dev-network

# Test connectivity
docker exec -it YOUR-CONTAINER ping diagram-converter
```

**VS Code not showing agents?**
- Restart VS Code completely
- Check `.vscode/*.agent.md` files exist
- Verify agent frontmatter is valid YAML

**MCP server not connecting?**
- Check MCP_API_KEY matches in settings.json
- Verify server is running: `curl http://localhost:3001/health`
- Check VS Code MCP extension is installed

## Next Steps

- **Configure Confluence**: Use `confluence_setup_project` MCP tool to set credentials
- **Convert diagrams**: Use `@diagram-converter` for batch conversions
- **Publish docs**: Use `@confluence-publisher` to publish markdown to Confluence
- **Customize**: See full docs in `README.md` and `docs/`

## Stop Services

```bash
docker stop diagram-converter confluence-mcp
docker rm diagram-converter confluence-mcp
```

To remove network:
```bash
docker network rm dev-network
```

## Summary

You now have:
- ✅ Diagram converter (SVG + Mermaid → PNG)
- ✅ Confluence MCP server
- ✅ VS Code agents for automation
- ✅ MCP tools for Confluence operations

**Services accessible at**:
- Diagram converter: http://localhost:3000
- Confluence MCP: http://localhost:3001

**VS Code agents**:
- `@diagram-converter` - Convert diagrams
- `@confluence-publisher` - Publish to Confluence

**MCP tools**:
- `confluence_setup_project` - Configure credentials
- `confluence_test_connection` - Test connection
- `confluence_create_page` - Create Confluence page
- `confluence_update_page` - Update existing page
- And more...

Enjoy! 🚀
