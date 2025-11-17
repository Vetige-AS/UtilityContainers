# Getting Started with Pandoc MCP

## What You Have Now

A complete Pandoc MCP server container that enables AI assistants to convert documents between formats through the Model Context Protocol.

## Quick Start (3 Steps)

### 1. Build and Start

```bash
# Navigate to repository
cd /path/to/UtilityContainers

# Build the container (choose one):
docker compose build pandoc-mcp              # Standard (no PDF support)
docker compose build -f Dockerfile.full pandoc-mcp  # Full (with PDF)

# Start the service
docker compose up -d pandoc-mcp

# Verify it's running
curl http://localhost:3002/health
```

### 2. Configure VS Code

```bash
# Fetch the configuration
curl http://localhost:3002/mcp/vscode -H "Accept: application/json" > pandoc-mcp-config.json

# View the config
cat pandoc-mcp-config.json
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

Set your API key (find it in `.env`):
```bash
export MCP_API_KEY="your-api-key-from-env-file"
```

### 3. Use It

Restart VS Code and ask your AI assistant:

```
"Convert workspace/docs/readme.md to HTML with table of contents"
```

or

```
"Convert this markdown to DOCX format"
```

## What Can You Do?

### Convert Text Content
Ask AI to convert inline text between formats:
```
"Convert this markdown text to HTML:
# Hello World
This is **bold** text."
```

### Convert Files
Ask AI to convert files in your workspace:
```
"Convert all markdown files in workspace/docs/ to HTML"
"Convert report.docx to markdown"
"Generate PDF from manual.md with TOC"
```

### Get Format Information
Ask AI about Pandoc capabilities:
```
"What formats does Pandoc support?"
"Show me Pandoc version and available formats"
```

## Complete Workflows

### Documentation Publishing
Use with confluence-mcp and diagram-converter:

```
"Take the documentation in workspace/docs/, convert Mermaid 
diagrams to PNG, then publish to Confluence Engineering space"
```

All three services work together:
1. diagram-converter → Convert diagrams
2. pandoc-mcp → Process documents  
3. confluence-mcp → Publish to Confluence

### PDF Generation
Generate professional PDFs (requires Dockerfile.full):

```
"Create a PDF from workspace/docs/guide.md with:
- Table of contents
- Numbered sections
- Syntax highlighting"
```

## For DevContainers

If you're using a devcontainer, add this to `.devcontainer/devcontainer.json`:

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
              "headers": { "x-mcp-api-key": "${env:MCP_API_KEY}" }
            }
          }
        }
      }
    }
  }
}
```

## Documentation

- **Quick Start**: [pandoc-mcp/QUICKSTART.md](pandoc-mcp/QUICKSTART.md)
- **Full API**: [pandoc-mcp/README.md](pandoc-mcp/README.md)
- **Integration Guide**: [pandoc-mcp/INTEGRATION.md](pandoc-mcp/INTEGRATION.md)
- **Complete Guide**: [docs/PANDOC_MCP.md](docs/PANDOC_MCP.md)
- **Workflow Examples**: [docs/COMPLETE_WORKFLOW_EXAMPLE.md](docs/COMPLETE_WORKFLOW_EXAMPLE.md)

## Troubleshooting

### Service won't start
```bash
docker compose logs pandoc-mcp
docker compose ps
```

### Can't connect from VS Code
Check that:
- Service is running: `curl http://localhost:3002/health`
- API key is set: `echo $MCP_API_KEY`
- VS Code settings are correct

### PDF conversion fails
Use Dockerfile.full:
```bash
docker compose build --build-arg DOCKERFILE=Dockerfile.full pandoc-mcp
docker compose up -d pandoc-mcp
```

## Need Help?

1. Check [QUICKSTART.md](pandoc-mcp/QUICKSTART.md) for setup
2. Review [INTEGRATION.md](pandoc-mcp/INTEGRATION.md) for advanced usage
3. Run validation: `./scripts/test-pandoc-mcp-setup.sh`
4. Check logs: `docker compose logs pandoc-mcp`

## What's Next?

- Explore format conversions with AI
- Integrate with your documentation workflow
- Combine with diagram-converter and confluence-mcp
- Automate document generation in CI/CD

Enjoy powerful document conversion with AI assistance! 🚀
