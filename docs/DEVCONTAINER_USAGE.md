# Using Confluence MCP and Diagram Converter from Devcontainers

## Overview

Both services run on the `dev-network` and are accessible from any devcontainer that joins the same network.

## Service Endpoints

When your devcontainer is on the `dev-network`, you can access:

- **Diagram Converter**: `http://diagram-converter:3000`
- **Confluence MCP**: `http://confluence-mcp:3001`

## Devcontainer Configuration

### Option 1: Basic Configuration

Add to your `.devcontainer/devcontainer.json`:

```json
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "runArgs": [
    "--network=dev-network"
  ]
}
```

### Option 2: With Docker Compose

If your devcontainer uses docker-compose, create `.devcontainer/docker-compose.yml`:

```yaml
version: '3.8'

services:
  devcontainer:
    image: mcr.microsoft.com/devcontainers/base:ubuntu
    volumes:
      - ..:/workspace:cached
    command: sleep infinity
    networks:
      - dev-network

networks:
  dev-network:
    external: true
    name: dev-network
```

And `.devcontainer/devcontainer.json`:

```json
{
  "name": "My Project",
  "dockerComposeFile": "docker-compose.yml",
  "service": "devcontainer",
  "workspaceFolder": "/workspace"
}
```

## Using the Diagram Converter from Devcontainer

### Convert SVG to PNG

```bash
# From inside your devcontainer
curl -X POST http://diagram-converter:3000/convert/svg2png \
  -F "file=@diagram.svg" \
  -o output.png
```

### Convert Mermaid to PNG

```bash
# From inside your devcontainer
curl -X POST http://diagram-converter:3000/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  --data-binary "@flowchart.mmd" \
  -o flowchart.png
```

### Health Check

```bash
curl http://diagram-converter:3000/health
```

## Using Confluence MCP from Devcontainer

### Authentication

The MCP server requires an API key. Set it as an environment variable in your devcontainer:

```json
{
  "remoteEnv": {
    "MCP_API_KEY": "your-api-key-here"
  }
}
```

Or load from your host `.env` file:

```json
{
  "runArgs": [
    "--network=dev-network",
    "--env-file=${localWorkspaceFolder}/.env"
  ]
}
```

### MCP Client Configuration

If you're using an MCP client (like Claude Desktop or similar), configure it to connect to:

```json
{
  "mcpServers": {
    "confluence": {
      "url": "http://confluence-mcp:3001/mcp",
      "transport": "sse",
      "headers": {
        "x-mcp-api-key": "${MCP_API_KEY}"
      }
    }
  }
}
```

### Available MCP Tools

The Confluence MCP server provides these tools:

1. **confluence_setup_project** - Configure Confluence credentials and defaults
2. **confluence_test_connection** - Test your Confluence connection
3. **confluence_show_config** - Show current configuration
4. **confluence_list_spaces** - List all Confluence spaces
5. **confluence_list_pages** - List pages in a space
6. **confluence_create_page** - Create a new page from Markdown
7. **confluence_update_page** - Update an existing page
8. **confluence_delete_page** - Delete a page

### Example: Setup from Devcontainer

```bash
# Using curl to call MCP tool
curl -X POST http://confluence-mcp:3001/mcp \
  -H "x-mcp-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "confluence_setup_project",
      "arguments": {
        "confluenceUrl": "https://yourcompany.atlassian.net",
        "username": "you@company.com",
        "apiToken": "your-confluence-token",
        "spaceKey": "YOURSPACE"
      }
    }
  }'
```

## Generic Mode Usage (Multiple Confluence Instances)

The MCP server supports **generic mode** where you can work with multiple Confluence instances.

### Setup Different Instances

Each devcontainer or project can configure its own Confluence instance:

```bash
# Project 1 devcontainer - Company A
export CONFLUENCE_BASE_URL=https://companyA.atlassian.net
export CONFLUENCE_USERNAME=user@companyA.com
export CONFLUENCE_API_TOKEN=token-a

# Project 2 devcontainer - Company B  
export CONFLUENCE_BASE_URL=https://companyB.atlassian.net
export CONFLUENCE_USERNAME=user@companyB.com
export CONFLUENCE_API_TOKEN=token-b
```

### Per-Request Credentials

You can also pass credentials with each MCP tool call:

```json
{
  "method": "tools/call",
  "params": {
    "name": "confluence_create_page",
    "arguments": {
      "title": "My Page",
      "markdownContent": "# Hello World",
      "spaceKey": "MYSPACE",
      "confluence": {
        "baseUrl": "https://specific-instance.atlassian.net",
        "username": "specific@user.com",
        "apiToken": "specific-token"
      }
    }
  }
}
```

## Example: Complete Workflow

### 1. Start the Services

```bash
# From your host machine
cd /home/per/code/docker-diagram-services
docker compose up -d
```

### 2. Configure Your Devcontainer

`.devcontainer/devcontainer.json`:
```json
{
  "name": "My Docs Project",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "runArgs": ["--network=dev-network"],
  "remoteEnv": {
    "MCP_API_KEY": "${localEnv:MCP_API_KEY}"
  },
  "customizations": {
    "vscode": {
      "settings": {
        "terminal.integrated.env.linux": {
          "DIAGRAM_CONVERTER_URL": "http://diagram-converter:3000",
          "CONFLUENCE_MCP_URL": "http://confluence-mcp:3001"
        }
      }
    }
  }
}
```

### 3. Use from Inside Devcontainer

```bash
# Convert diagrams
curl -X POST $DIAGRAM_CONVERTER_URL/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  --data-binary "@architecture.mmd" \
  -o architecture.png

# Setup Confluence
curl -X POST $CONFLUENCE_MCP_URL/mcp \
  -H "x-mcp-api-key: $MCP_API_KEY" \
  # ... (MCP setup call)
```

## Testing Connectivity

### From Your Devcontainer

```bash
# Test diagram converter
curl http://diagram-converter:3000/health

# Test MCP server
curl http://confluence-mcp:3001/health

# Test network connectivity
ping diagram-converter
ping confluence-mcp
```

## Troubleshooting

### Can't Connect to Services

```bash
# 1. Check you're on the dev-network
docker network inspect dev-network

# 2. Verify services are running
docker compose ps

# 3. Check devcontainer network
docker inspect <your-devcontainer-id> | grep NetworkMode
```

### DNS Resolution Issues

If container names don't resolve, use IP addresses:

```bash
# Find service IPs
docker inspect diagram-converter | grep IPAddress
docker inspect confluence-mcp | grep IPAddress
```

### Port Conflicts

Services use ports 3000 and 3001 internally. These don't conflict with your devcontainer ports.

## Benefits of This Setup

✅ **Isolation** - Services run independently of your devcontainer  
✅ **Shared** - All devcontainers can use the same services  
✅ **Persistent** - Services keep running between devcontainer rebuilds  
✅ **Generic** - Each devcontainer can configure its own Confluence instance  
✅ **Scalable** - Easy to add more shared services to dev-network  

## Advanced: Multiple Environments

You can run multiple MCP instances for different environments:

```yaml
# docker-compose.yml
services:
  confluence-mcp-prod:
    image: confluence-mcp
    container_name: confluence-mcp-prod
    ports: ["3001:3001"]
    networks: [dev-network]
    environment:
      - CONFLUENCE_BASE_URL=https://prod.atlassian.net
      
  confluence-mcp-staging:
    image: confluence-mcp
    container_name: confluence-mcp-staging
    ports: ["3002:3001"]
    networks: [dev-network]
    environment:
      - CONFLUENCE_BASE_URL=https://staging.atlassian.net
```

Access them as:
- `http://confluence-mcp-prod:3001`
- `http://confluence-mcp-staging:3001`
