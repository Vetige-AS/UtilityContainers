# Pandoc MCP Server - Complete Guide

## Quick Links

- [QUICKSTART.md](../pandoc-mcp/QUICKSTART.md) - Get started quickly
- [README.md](../pandoc-mcp/README.md) - Full API documentation
- [INTEGRATION.md](../pandoc-mcp/INTEGRATION.md) - Integration scenarios and workflows
- [MCP_VSCODE_CONFIG.md](MCP_VSCODE_CONFIG.md) - VS Code MCP configuration
- [AGENT_ENDPOINTS.md](AGENT_ENDPOINTS.md) - Agent definition endpoints

## What is Pandoc MCP?

Pandoc MCP is a Model Context Protocol (MCP) server that provides AI assistants (like GitHub Copilot) with document conversion capabilities through Pandoc. It converts between 40+ document formats including:

- Markdown ↔ HTML
- Markdown ↔ PDF (with LaTeX)
- Markdown ↔ DOCX
- DOCX ↔ Markdown
- HTML ↔ PDF
- And many more...

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistant  │◄──►│   Pandoc MCP     │◄──►│     Pandoc      │
│   (VS Code)     │    │   Server (SSE)   │    │   (CLI Tool)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Workspace Files │
                       └──────────────────┘
```

## Key Features

✅ **MCP Protocol** - Server-Sent Events (SSE) transport for real-time communication  
✅ **40+ Formats** - Extensive format support via Pandoc  
✅ **Secure** - API key authentication, rate limiting, security headers  
✅ **Docker Ready** - Pre-built containers with Pandoc installed  
✅ **VS Code Integration** - Automatic configuration generation  
✅ **Multi-Project** - Support for multiple projects with unique containers  
✅ **DevContainer Ready** - Works seamlessly with VS Code devcontainers  
✅ **Agent Support** - VS Code agent definition for enhanced AI interaction

## Available Tools

The MCP server exposes these tools to AI assistants:

### 1. pandoc_convert

Convert text content between formats.

**Parameters:**
- `input` - Text content to convert
- `inputFormat` - Source format (e.g., "markdown")
- `outputFormat` - Target format (e.g., "html")
- `standalone` - Include headers/footers
- `toc` - Include table of contents
- `numberSections` - Number document sections
- `highlightStyle` - Code syntax highlighting
- Additional options...

### 2. pandoc_convert_file

Convert files between formats.

**Parameters:**
- `inputPath` - Source file path (relative to workspace)
- `outputPath` - Destination file path
- `inputFormat` - Source format (auto-detected if omitted)
- `outputFormat` - Target format (inferred from extension)
- Same options as pandoc_convert...

### 3. pandoc_info

Get Pandoc version and supported formats.

**Returns:**
- Pandoc version
- List of input formats
- List of output formats
- Default settings

## Endpoints

### MCP Endpoints

- `GET /mcp` - SSE connection for MCP protocol (requires auth)
- `POST /messages` - Send MCP messages (requires sessionId)

### Utility Endpoints

- `GET /health` - Health check
- `GET /agent` - VS Code agent definition
- `GET /mcp/vscode` - Auto-generated VS Code configuration

## Quick Setup

### 1. Start the Service

```bash
# Create network (first time only)
docker network create dev-network

# Set API key in .env
echo "MCP_API_KEY=$(openssl rand -hex 32)" > .env

# Start pandoc-mcp
docker compose up -d pandoc-mcp
```

### 2. Verify It's Running

```bash
curl http://localhost:3002/health
```

### 3. Configure VS Code

```bash
# Fetch configuration
curl http://localhost:3002/mcp/vscode > pandoc-config.md

# Or get JSON directly
curl -H "Accept: application/json" http://localhost:3002/mcp/vscode \
  | jq '.config' > .vscode/pandoc-mcp.json
```

Add to `.vscode/settings.json`:
```json
{
  "mcp": {
    "servers": {
      "pandoc": {
        "url": "http://localhost:3002/mcp",
        "transport": { "type": "sse" },
        "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" },
        "description": "Pandoc MCP Server"
      }
    }
  }
}
```

### 4. Use in VS Code

Ask AI assistant:
- "Convert docs/readme.md to HTML"
- "Convert this markdown to PDF with TOC"
- "Convert all DOCX files to markdown"

## Docker Images

### Standard Image (Default)

- **Size**: ~300MB
- **Includes**: Pandoc without LaTeX
- **Supports**: Most formats (HTML, DOCX, Markdown, etc.)
- **Missing**: PDF output
- **Build**: `docker compose build pandoc-mcp`

### Full Image (with PDF)

- **Size**: ~800MB
- **Includes**: Pandoc with LaTeX
- **Supports**: All formats including PDF
- **Build**: `docker build -f Dockerfile.full -t pandoc-mcp .`

Update docker-compose.yml for PDF support:
```yaml
pandoc-mcp:
  build:
    context: ./pandoc-mcp
    dockerfile: Dockerfile.full
```

## Integration Patterns

### Pattern 1: Standalone

Use pandoc-mcp independently for document conversion.

```bash
docker compose up -d pandoc-mcp
# Use via MCP in VS Code
```

### Pattern 2: With Confluence MCP

Convert and publish to Confluence.

```bash
docker compose up -d pandoc-mcp confluence-mcp
# Convert → Publish workflow
```

### Pattern 3: Complete Workflow

All services for end-to-end documentation.

```bash
docker compose up -d
# Diagrams → Convert → Publish
```

## DevContainer Integration

### Option 1: Host Containers (Recommended)

Run on host, access from devcontainer.

**Advantages:**
- Containers persist across rebuilds
- Faster devcontainer startup
- Shared across projects

**devcontainer.json:**
```json
{
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
              "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" }
            }
          }
        }
      }
    }
  }
}
```

### Option 2: DevContainer Compose

Include in devcontainer's compose file.

**Advantages:**
- Self-contained project
- Project-specific config

See [INTEGRATION.md](../pandoc-mcp/INTEGRATION.md) for details.

## Multi-Project Setup

Run separate instances per project:

**Project A:**
```env
PROJECT_NAME=project-a
PANDOC_MCP_PORT=3002
```

Container name: `project-a-pandoc-mcp`  
Access: `http://project-a-pandoc-mcp:3002` (from devcontainer)

**Project B:**
```env
PROJECT_NAME=project-b
PANDOC_MCP_PORT=3003
```

Container name: `project-b-pandoc-mcp`  
Access: `http://project-b-pandoc-mcp:3002` (from devcontainer)

## Common Workflows

### Convert Markdown to HTML

```
AI: "Convert docs/guide.md to HTML with TOC"
```

### Generate PDF Documentation

```
AI: "Create PDF from manual.md with numbered sections"
```

Note: Requires Dockerfile.full (LaTeX)

### Batch Conversion

```
AI: "Convert all markdown files in docs/ to HTML"
```

### DOCX to Markdown

```
AI: "Convert report.docx to markdown"
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs pandoc-mcp

# Verify network
docker network inspect dev-network

# Check port
lsof -i :3002
```

### Can't Connect from DevContainer

```bash
# Inside devcontainer
ping pandoc-mcp
curl http://pandoc-mcp:3002/health
```

Verify:
- devcontainer.json has `--network=dev-network`
- MCP_API_KEY is set
- Container is running

### PDF Conversion Fails

Use Dockerfile.full:
```bash
docker compose build --build-arg DOCKERFILE=Dockerfile.full pandoc-mcp
```

## Security

- ✅ API key authentication required
- ✅ Rate limiting (100 req/15min)
- ✅ Security headers enabled
- ✅ File access limited to /workspace
- ✅ Input validation and sanitization

## Best Practices

1. **Use environment variables** for API keys
2. **Choose appropriate Dockerfile** (standard vs. full)
3. **Fetch configs dynamically** via `/mcp/vscode`
4. **Use project names** for multi-project setups
5. **Test with health check** before use
6. **Document your workflows** for team
7. **Monitor resource usage** for large files

## Resources

- [Pandoc Documentation](https://pandoc.org/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [VS Code MCP Extension](https://marketplace.visualstudio.com/)

## Support

1. Check [QUICKSTART.md](../pandoc-mcp/QUICKSTART.md) for basic setup
2. Review [INTEGRATION.md](../pandoc-mcp/INTEGRATION.md) for advanced use
3. Run test script: `./scripts/test-pandoc-mcp-setup.sh`
4. Check logs: `docker compose logs pandoc-mcp`
5. Verify health: `curl http://localhost:3002/health`

## Summary

Pandoc MCP provides AI assistants with powerful document conversion capabilities through a secure, containerized MCP server. It integrates seamlessly with VS Code, DevContainers, and other utility services for complete documentation workflows.

**Get started:** Follow [QUICKSTART.md](../pandoc-mcp/QUICKSTART.md)  
**Integration:** See [INTEGRATION.md](../pandoc-mcp/INTEGRATION.md)  
**API Details:** Read [README.md](../pandoc-mcp/README.md)
