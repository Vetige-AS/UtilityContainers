# Pandoc MCP Integration Guide

This guide shows how to integrate the Pandoc MCP server with your projects and other utility containers.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Integration Scenarios](#integration-scenarios)
- [DevContainer Setup](#devcontainer-setup)
- [Multi-Project Setup](#multi-project-setup)
- [VS Code Configuration](#vs-code-configuration)
- [Workflow Examples](#workflow-examples)

## Overview

The Pandoc MCP server provides document conversion capabilities through the Model Context Protocol (MCP). It integrates seamlessly with:

- **VS Code** via MCP protocol for AI-powered document conversion
- **DevContainers** via Docker network connectivity
- **Other utility containers** (diagram-converter, confluence-mcp) for complete workflows
- **Multiple projects** via unique container names and ports

## Quick Start

### 1. Prerequisites

```bash
# Docker and dev-network
docker network create dev-network

# Generate API key
openssl rand -hex 32
```

### 2. Configure Environment

Create or update `.env`:

```env
MCP_API_KEY=your-generated-api-key-here
PANDOC_MCP_PORT=3002
```

### 3. Start the Service

```bash
# Using docker-compose
docker compose up -d pandoc-mcp

# Or using docker directly
cd pandoc-mcp
docker build -t pandoc-mcp .
docker run -d --name pandoc-mcp \
  --network dev-network \
  -p 3002:3002 \
  -v $(pwd)/workspace:/workspace \
  --env-file ../.env \
  pandoc-mcp
```

### 4. Verify It's Running

```bash
curl http://localhost:3002/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "pandoc-mcp",
#   "version": "0.1.0"
# }
```

## Integration Scenarios

### Scenario 1: Standalone Document Conversion

Use pandoc-mcp independently for document conversion tasks.

**Use case**: Convert Markdown documentation to HTML or DOCX

```bash
# Place your markdown files in workspace/
mkdir -p workspace/docs
echo "# My Document" > workspace/docs/readme.md

# Use AI assistant with MCP to convert
# "Convert workspace/docs/readme.md to HTML"
```

The MCP server will:
1. Read the markdown file
2. Convert to HTML using Pandoc
3. Save to specified output location

### Scenario 2: Documentation Publishing Workflow

Combine pandoc-mcp with confluence-mcp for complete documentation workflows.

**Use case**: Convert and publish documentation to Confluence

```bash
# Start both services
docker compose up -d pandoc-mcp confluence-mcp

# Workflow:
# 1. Write documentation in Markdown
# 2. Convert to Confluence format using pandoc-mcp
# 3. Publish using confluence-mcp
```

Example AI prompt:
```
"Convert the markdown files in workspace/docs/ to Confluence format
and publish them to the Documentation space"
```

### Scenario 3: Diagram + Document Workflow

Integrate with diagram-converter for complete document preparation.

**Use case**: Create technical documentation with diagrams

```bash
# Start all services
docker compose up -d

# Workflow:
# 1. Create diagrams (Mermaid, SVG) using diagram-converter
# 2. Embed in Markdown documentation
# 3. Convert entire document using pandoc-mcp
# 4. Optionally publish to Confluence
```

Example AI prompt:
```
"Convert the Mermaid diagrams in my documentation to PNG,
update the markdown to reference them, then convert the
whole document to PDF with a table of contents"
```

## DevContainer Setup

### Method 1: Docker-Outside-of-Docker (Recommended)

Run pandoc-mcp on the host, access from devcontainer.

**Benefits:**
- Container persists across devcontainer rebuilds
- Faster startup
- Shared across multiple projects

**Setup:**

1. **On Host:** Start pandoc-mcp

```bash
cd ~/UtilityContainers
docker compose up -d pandoc-mcp
```

2. **In Project:** Configure devcontainer.json

```json
{
  "name": "My Project",
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {}
  },
  "runArgs": ["--network=dev-network"],
  "containerEnv": {
    "MCP_API_KEY": "${localEnv:MCP_API_KEY}"
  },
  "customizations": {
    "vscode": {
      "settings": {
        "mcp": {
          "servers": {
            "pandoc": {
              "url": "http://pandoc-mcp:3002/mcp",
              "transport": { "type": "sse" },
              "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" },
              "description": "Pandoc MCP Server"
            }
          }
        }
      }
    }
  },
  "postCreateCommand": "curl http://pandoc-mcp:3002/agent > .vscode/pandoc-agent.agent.md"
}
```

3. **Set Environment Variable**

```bash
# On host
export MCP_API_KEY="your-api-key-here"
```

### Method 2: DevContainer Compose

Include pandoc-mcp in your devcontainer's docker-compose.

**Benefits:**
- Self-contained project setup
- Project-specific configuration

**Setup:**

Create `.devcontainer/docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ..:/workspace:cached
    command: sleep infinity
    networks:
      - dev-network

  pandoc-mcp:
    image: pandoc-mcp:latest
    container_name: ${PROJECT_NAME:-myproject}-pandoc-mcp
    volumes:
      - ../workspace:/workspace
    environment:
      - MCP_API_KEY=${MCP_API_KEY}
    networks:
      - dev-network

networks:
  dev-network:
    external: true
```

## Multi-Project Setup

Run separate pandoc-mcp instances for different projects.

### Project A

**Directory:** `~/projects/project-a`

**`.env`:**
```env
PROJECT_NAME=project-a
PANDOC_MCP_PORT=3002
MCP_API_KEY=key-for-project-a
```

**Start:**
```bash
cd ~/projects/project-a
docker compose up -d pandoc-mcp
```

**Access:**
- From host: `http://localhost:3002`
- From devcontainer: `http://project-a-pandoc-mcp:3002`
- Container name: `project-a-pandoc-mcp`

### Project B

**Directory:** `~/projects/project-b`

**`.env`:**
```env
PROJECT_NAME=project-b
PANDOC_MCP_PORT=3003
MCP_API_KEY=key-for-project-b
```

**Start:**
```bash
cd ~/projects/project-b
docker compose up -d pandoc-mcp
```

**Access:**
- From host: `http://localhost:3003`
- From devcontainer: `http://project-b-pandoc-mcp:3002`
- Container name: `project-b-pandoc-mcp`

### Benefits of Multi-Project

- **Isolation:** Each project has its own pandoc-mcp instance
- **Configuration:** Different settings per project
- **Security:** Separate API keys
- **Flexibility:** Can use different Pandoc versions/configurations

## VS Code Configuration

### Automatic Configuration

Fetch configuration from the running service:

```bash
# Get configuration for current project
curl http://localhost:3002/mcp/vscode?project=myproject \
  -H "Accept: application/json" \
  | jq '.config' > .vscode/pandoc-mcp-config.json
```

### Manual Configuration

Add to `.vscode/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "pandoc": {
        "url": "http://localhost:3002/mcp",
        "transport": {
          "type": "sse"
        },
        "headers": {
          "x-mcp-api-key": "${env:MCP_API_KEY}"
        },
        "description": "Pandoc MCP Server"
      }
    }
  }
}
```

### Agent Definition

Fetch the VS Code agent definition:

```bash
curl http://localhost:3002/agent > .vscode/pandoc-converter.agent.md
```

Then restart VS Code. You can now use `@pandoc-converter` in conversations.

## Workflow Examples

### Example 1: Convert All Markdown to HTML

```markdown
Ask AI: "Convert all markdown files in workspace/docs/ to HTML 
with table of contents and save them in workspace/output/"
```

The AI will:
1. List all .md files in workspace/docs/
2. For each file, call `pandoc_convert_file` with:
   - `standalone: true`
   - `toc: true`
   - Output to workspace/output/

### Example 2: Generate PDF Documentation

```markdown
Ask AI: "Create a PDF from workspace/docs/manual.md with numbered 
sections and a table of contents"
```

The AI will use `pandoc_convert_file`:
```json
{
  "inputPath": "workspace/docs/manual.md",
  "outputPath": "workspace/output/manual.pdf",
  "standalone": true,
  "toc": true,
  "numberSections": true
}
```

Note: PDF output requires Dockerfile.full (with LaTeX).

### Example 3: Markdown to DOCX for Review

```markdown
Ask AI: "Convert my documentation to Word format for stakeholder review"
```

The AI will:
1. Find markdown files
2. Convert to DOCX format
3. Maintain formatting and structure

### Example 4: Complete Publishing Workflow

```markdown
Ask AI: "Take the markdown documentation in workspace/docs/, 
convert diagrams to PNG, then publish to Confluence"
```

This uses multiple services:
1. **diagram-converter**: Convert Mermaid/SVG diagrams
2. **pandoc-mcp**: Update markdown with converted diagrams
3. **confluence-mcp**: Publish to Confluence

### Example 5: Batch Conversion

```markdown
Ask AI: "Convert all DOCX files in workspace/input/ to markdown"
```

The AI will:
1. List all .docx files
2. Convert each to markdown
3. Save to workspace/output/

## Advanced Integration

### Custom Templates

Place templates in workspace:

```bash
mkdir -p workspace/templates
# Add your custom-template.html
```

Use in conversion:
```json
{
  "template": "/workspace/templates/custom-template.html",
  "standalone": true
}
```

### Metadata and Variables

Add metadata to conversions:

```json
{
  "metadata": {
    "title": "Technical Documentation",
    "author": "Engineering Team",
    "date": "2024"
  },
  "variables": {
    "geometry": "margin=1in",
    "fontsize": "11pt"
  }
}
```

### Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Build Documentation

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Start pandoc-mcp
        run: |
          docker network create dev-network
          docker compose up -d pandoc-mcp
          
      - name: Convert documentation
        run: |
          # Your conversion commands here
          docker exec pandoc-mcp pandoc docs/readme.md -o output/readme.html
```

## Troubleshooting

### Service Not Accessible

```bash
# Check if running
docker ps | grep pandoc-mcp

# Check logs
docker compose logs pandoc-mcp

# Verify network
docker network inspect dev-network
```

### PDF Conversion Fails

Make sure you're using Dockerfile.full:

```bash
docker compose build --build-arg DOCKERFILE=Dockerfile.full pandoc-mcp
```

Or update docker-compose.yml:
```yaml
pandoc-mcp:
  build:
    context: ./pandoc-mcp
    dockerfile: Dockerfile.full
```

### Connection from DevContainer

```bash
# From inside devcontainer, test connectivity
ping pandoc-mcp
curl http://pandoc-mcp:3002/health
```

If failing:
- Verify devcontainer is on dev-network
- Check runArgs in devcontainer.json includes `--network=dev-network`

## Security Considerations

1. **API Keys**: Never commit API keys to git
2. **Environment Variables**: Use .env files (gitignored)
3. **File Access**: Pandoc only accesses /workspace directory
4. **Network**: Use dev-network for isolation
5. **Rate Limiting**: Built-in (100 requests per 15 minutes)

## Best Practices

1. **Use project names** for multi-project setups
2. **Fetch configurations dynamically** from `/mcp/vscode` endpoint
3. **Test with health check** before use
4. **Keep API keys secure** in environment variables
5. **Use appropriate Dockerfile** (standard vs. full)
6. **Document workflows** for team members
7. **Monitor resource usage** for large documents

## Next Steps

- Review [QUICKSTART.md](QUICKSTART.md) for basic setup
- Check [README.md](pandoc-mcp/README.md) for API details
- See [MCP_VSCODE_CONFIG.md](docs/MCP_VSCODE_CONFIG.md) for VS Code integration
- Explore [AGENT_ENDPOINTS.md](docs/AGENT_ENDPOINTS.md) for agent configuration

## Support

For issues:
1. Check logs: `docker compose logs pandoc-mcp`
2. Verify setup: `./scripts/test-pandoc-mcp-setup.sh`
3. Review [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
4. Check health: `curl http://localhost:3002/health`
