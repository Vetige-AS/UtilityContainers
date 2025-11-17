# Pandoc MCP Server - Quick Start Guide

This guide helps you set up and use the Pandoc MCP server for document format conversion.

## What is Pandoc MCP?

Pandoc MCP is a Model Context Protocol (MCP) server that provides AI assistants with the ability to convert documents between various formats using Pandoc. It supports 40+ formats including Markdown, HTML, PDF, DOCX, and more.

## Prerequisites

- Docker installed and running
- Docker network `dev-network` created
- MCP_API_KEY generated

## Quick Setup

### 1. Create Docker Network (if not already created)

```bash
docker network create dev-network
```

### 2. Generate API Key

```bash
# Generate a new API key
openssl rand -hex 32

# Or use the included script
cd pandoc-mcp
npm run generate-key
```

### 3. Configure Environment

```bash
# Copy the example .env file
cp .env.example .env

# Edit .env and add your API key
nano .env
```

Set at minimum:
```env
MCP_API_KEY=your-generated-api-key-here
```

### 4. Start the Service

```bash
# From the repository root
docker-compose up -d pandoc-mcp

# Or build and start
docker-compose build pandoc-mcp
docker-compose up -d pandoc-mcp
```

### 5. Verify It's Running

```bash
# Check health
curl http://localhost:3002/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "pandoc-mcp",
#   "version": "0.1.0",
#   "timestamp": "..."
# }
```

## Using Pandoc MCP

### From VS Code with MCP

1. **Fetch the configuration:**

```bash
curl http://localhost:3002/mcp/vscode > pandoc-mcp-config.md
```

2. **Add to VS Code settings** (.vscode/settings.json):

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

3. **Set environment variable:**

```bash
# Linux/macOS
export MCP_API_KEY="your-api-key-here"

# Windows PowerShell
$env:MCP_API_KEY = "your-api-key-here"
```

4. **Restart VS Code** to load the MCP server

### From DevContainer

1. **Update docker-compose.yml** (already included if using this repo):

```yaml
services:
  pandoc-mcp:
    image: pandoc-mcp:latest
    container_name: ${PROJECT_NAME:-myproject}-pandoc-mcp
    ports:
      - "${PANDOC_MCP_PORT:-3002}:3002"
    volumes:
      - ./workspace:/workspace
    networks:
      - dev-network
```

2. **Fetch configuration for devcontainer:**

```bash
curl http://pandoc-mcp:3002/mcp/vscode?devcontainer=true > .vscode/pandoc-config.md
```

3. **Add to devcontainer.json:**

```json
{
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
              "description": "Pandoc MCP"
            }
          }
        }
      }
    }
  }
}
```

## Available MCP Tools

The Pandoc MCP server provides these tools to AI assistants:

### 1. pandoc_convert

Convert text content between formats.

**Example:**
```json
{
  "tool": "pandoc_convert",
  "input": "# Hello World\n\nThis is **bold** text.",
  "inputFormat": "markdown",
  "outputFormat": "html",
  "standalone": true
}
```

### 2. pandoc_convert_file

Convert files between formats.

**Example:**
```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "docs/readme.md",
  "outputPath": "output/readme.pdf",
  "standalone": true,
  "toc": true
}
```

### 3. pandoc_info

Get Pandoc version and supported formats.

**Example:**
```json
{
  "tool": "pandoc_info"
}
```

## Common Use Cases

### Convert Markdown to HTML

```bash
# Tell your AI assistant:
"Convert the markdown file docs/guide.md to HTML with a table of contents"
```

The AI will use:
```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "docs/guide.md",
  "outputPath": "output/guide.html",
  "standalone": true,
  "toc": true
}
```

### Convert Markdown to PDF

```bash
# Tell your AI assistant:
"Convert readme.md to PDF with numbered sections"
```

The AI will use:
```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "readme.md",
  "outputPath": "readme.pdf",
  "standalone": true,
  "numberSections": true
}
```

### Convert DOCX to Markdown

```bash
# Tell your AI assistant:
"Convert document.docx to markdown format"
```

The AI will use:
```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "document.docx",
  "outputPath": "document.md"
}
```

## Multi-Project Setup

Run separate instances for different projects:

### Project A

```bash
# .env for Project A
PROJECT_NAME=project-a
PANDOC_MCP_PORT=3002
MCP_API_KEY=key-for-project-a
```

```bash
docker-compose up -d
```

Container name: `project-a-pandoc-mcp`
Access from devcontainer: `http://project-a-pandoc-mcp:3002`

### Project B

```bash
# .env for Project B
PROJECT_NAME=project-b
PANDOC_MCP_PORT=3003
MCP_API_KEY=key-for-project-b
```

```bash
docker-compose up -d
```

Container name: `project-b-pandoc-mcp`
Access from devcontainer: `http://project-b-pandoc-mcp:3002`

## Supported Formats

### Input Formats (selection)
- **markdown** - Pandoc's Markdown
- **gfm** - GitHub-Flavored Markdown
- **html** - HTML
- **docx** - Microsoft Word
- **odt** - OpenDocument Text
- **latex** - LaTeX
- **rst** - reStructuredText
- **textile** - Textile
- **mediawiki** - MediaWiki markup
- **org** - Emacs Org-mode

### Output Formats (selection)
- **html** - HTML5
- **pdf** - PDF (via LaTeX)
- **docx** - Microsoft Word
- **odt** - OpenDocument Text
- **epub** - EPUB
- **epub3** - EPUB v3
- **latex** - LaTeX
- **beamer** - LaTeX beamer (slides)
- **markdown** - Pandoc's Markdown
- **gfm** - GitHub-Flavored Markdown
- **rst** - reStructuredText
- **plain** - Plain text

Run `pandoc_info` tool to see all supported formats.

## Troubleshooting

### Service Not Starting

```bash
# Check logs
docker-compose logs pandoc-mcp

# Check container status
docker ps | grep pandoc-mcp
```

### Connection Refused

```bash
# Verify network
docker network inspect dev-network

# Check if container is on the network
docker inspect pandoc-mcp | grep NetworkMode
```

### PDF Conversion Fails

PDF conversion requires LaTeX, which is included in the Docker image. For complex documents, you may need additional LaTeX packages. Check the logs for specific package requirements.

```bash
docker-compose logs pandoc-mcp
```

### Files Not Found

Ensure files are in the workspace directory:

```bash
# Create a test file
mkdir -p workspace/docs
echo "# Test" > workspace/docs/test.md

# Convert it
# Then tell AI: "Convert workspace/docs/test.md to HTML"
```

## Advanced Configuration

### Custom Templates

Place templates in the workspace:

```bash
mkdir -p workspace/templates
# Add your custom.html template
```

Use with conversion:
```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "docs/report.md",
  "outputPath": "output/report.html",
  "template": "/workspace/templates/custom.html",
  "standalone": true
}
```

### Metadata and Variables

```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "docs/report.md",
  "outputPath": "output/report.pdf",
  "standalone": true,
  "metadata": {
    "title": "Annual Report",
    "author": "John Doe",
    "date": "2024"
  },
  "variables": {
    "geometry": "margin=1in",
    "fontsize": "12pt"
  }
}
```

## Integration with Other Services

Pandoc MCP works well with:

- **Confluence MCP**: Convert documents before publishing
- **Diagram Converter**: Embed diagrams in converted documents
- **Custom CI/CD**: Automate documentation builds

Example workflow:
1. Write documentation in Markdown
2. Convert diagrams using diagram-converter
3. Convert Markdown to PDF using pandoc-mcp
4. Publish to Confluence using confluence-mcp

## Next Steps

- Read the [full README](pandoc-mcp/README.md) for detailed API documentation
- Check [MCP_VSCODE_CONFIG.md](docs/MCP_VSCODE_CONFIG.md) for VS Code integration
- See [AGENT_ENDPOINTS.md](docs/AGENT_ENDPOINTS.md) for agent setup
- Explore [Pandoc's documentation](https://pandoc.org/) for advanced features

## Getting Help

1. Check container logs: `docker-compose logs pandoc-mcp`
2. Verify health: `curl http://localhost:3002/health`
3. Test connection: `curl -H "x-mcp-api-key: $MCP_API_KEY" http://localhost:3002/mcp`
4. Review [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Summary

You now have a Pandoc MCP server running that:
- ✅ Converts documents between 40+ formats
- ✅ Integrates with VS Code via MCP
- ✅ Works in devcontainer environments
- ✅ Supports multi-project setups
- ✅ Provides AI assistants with document conversion capabilities

Happy converting! 🚀
