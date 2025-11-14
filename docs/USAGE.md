# Usage Guide

Complete guide for using the Docker Diagram Services.

## Table of Contents

1. [HTTP API Usage](#http-api-usage)
2. [Script Usage](#script-usage)
3. [MCP Integration](#mcp-integration)
4. [Devcontainer Integration](#devcontainer-integration)
5. [Workflow Examples](#workflow-examples)

## HTTP API Usage

The diagram converter service provides a simple HTTP API.

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "service": "diagram-converter",
  "endpoints": [...],
  "uptime": 1234.56
}
```

### Convert SVG to PNG

```bash
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@path/to/diagram.svg" \
  -F "density=300" \
  -o output.png
```

Parameters:
- `file`: SVG file (required)
- `density`: DPI resolution (optional, default: 300)

### Convert Mermaid Code to PNG

```bash
# From file
curl -X POST http://localhost:3000/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  --data-binary "@path/to/diagram.mmd" \
  -o output.png

# From string
curl -X POST http://localhost:3000/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  -d "graph TD; A-->B; B-->C;" \
  -o output.png
```

### From Other Containers

If your container is on the `dev-network`:

```bash
# Use container name instead of localhost
curl http://diagram-converter:3000/health
```

## Script Usage

### Test Services

```bash
./scripts/test-services.sh
```

Shows:
- Service health status
- Container status
- Network configuration
- Resource usage

### Convert Single Diagram

```bash
# Convert SVG
./scripts/convert-diagram.sh svg \
  workspace/diagrams/architecture.svg \
  workspace/diagrams/architecture.png

# Convert Mermaid
./scripts/convert-diagram.sh mermaid \
  workspace/diagrams/flow.mmd \
  workspace/diagrams/flow.png
```

### Process Complete Markdown

```bash
./scripts/process-markdown.sh workspace/docs/my-document.md
```

This will:
1. Find all `![alt](diagram.svg)` references
2. Find all `![alt](diagram.mmd)` references
3. Convert each to PNG
4. Create `my-document_processed.md` with updated references

## MCP Integration

### Configure AI Assistant

#### Claude Desktop

Edit `~/.config/claude/config.json`:

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

#### Cursor IDE

Add to settings:

```json
{
  "mcp.servers": {
    "confluence": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### Using MCP with AI Agents

Once configured, you can ask your AI assistant:

```
"Take the markdown file at workspace/docs/api-guide.md, 
convert all diagrams to PNG, and publish to Confluence 
space DEV under the parent page 'Documentation'"
```

The MCP server will:
1. Process the markdown
2. Convert diagrams
3. Publish to Confluence
4. Return the page URL

## Devcontainer Integration

### Method 1: Join Network

In your `.devcontainer/devcontainer.json`:

```json
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "runArgs": ["--network=dev-network"]
}
```

Now you can access services:
```bash
curl http://diagram-converter:3000/health
```

### Method 2: Reference Docker Compose

```json
{
  "name": "My Project",
  "dockerComposeFile": [
    "../docker-diagram-services/docker-compose.yml",
    "docker-compose.yml"
  ],
  "service": "my-service",
  "workspaceFolder": "/workspace"
}
```

### Method 3: Use from Host

Since ports are mapped to localhost:
```bash
curl http://localhost:3000/health
```

## Workflow Examples

### Workflow 1: Create Documentation with Diagrams

```bash
# 1. Create markdown document
cat > workspace/docs/architecture.md << 'EOF'
# System Architecture

## Overview
![System Diagram](../diagrams/system.svg)

## Data Flow
![Flow Diagram](../diagrams/flow.mmd)
EOF

# 2. Create SVG diagram
cat > workspace/diagrams/system.svg << 'EOF'
<svg width="200" height="200">
  <circle cx="100" cy="100" r="80" fill="blue"/>
</svg>
EOF

# 3. Create Mermaid diagram
cat > workspace/diagrams/flow.mmd << 'EOF'
graph LR
    A[Input] --> B[Process]
    B --> C[Output]
EOF

# 4. Process the document
./scripts/process-markdown.sh workspace/docs/architecture.md

# 5. Result: workspace/docs/architecture_processed.md
#    Contains PNG references instead of SVG/MMD
```

### Workflow 2: Batch Convert Diagrams

```bash
# Convert all SVGs in a directory
for svg in workspace/diagrams/*.svg; do
    png="${svg%.svg}.png"
    ./scripts/convert-diagram.sh svg "$svg" "$png"
done

# Convert all Mermaid files
for mmd in workspace/diagrams/*.mmd; do
    png="${mmd%.mmd}.png"
    ./scripts/convert-diagram.sh mermaid "$mmd" "$png"
done
```

### Workflow 3: PowerShell Integration

Create `Convert-AllDiagrams.ps1`:

```powershell
param([string]$MarkdownFile)

$basePath = Split-Path $MarkdownFile -Parent
$content = Get-Content $MarkdownFile -Raw

# Find and convert SVG files
$svgPattern = '!\[([^\]]*)\]\(([^)]*\.svg)\)'
[regex]::Matches($content, $svgPattern) | ForEach-Object {
    $svgPath = Join-Path $basePath $_.Groups[2].Value
    $pngPath = $svgPath -replace '\.svg$', '.png'
    
    $formData = @{
        file = Get-Item $svgPath
    }
    
    Invoke-RestMethod -Uri "http://localhost:3000/convert/svg2png" `
        -Method Post -Form $formData `
        -OutFile $pngPath
    
    Write-Host "Converted: $svgPath"
}

# Find and convert Mermaid files
$mmdPattern = '!\[([^\]]*)\]\(([^)]*\.mmd)\)'
[regex]::Matches($content, $mmdPattern) | ForEach-Object {
    $mmdPath = Join-Path $basePath $_.Groups[2].Value
    $pngPath = $mmdPath -replace '\.mmd$', '.png'
    
    $mmdContent = Get-Content $mmdPath -Raw
    
    Invoke-RestMethod -Uri "http://localhost:3000/convert/mermaid2png" `
        -Method Post -Body $mmdContent `
        -ContentType "text/plain" `
        -OutFile $pngPath
    
    Write-Host "Converted: $mmdPath"
}
```

Usage:
```powershell
pwsh Convert-AllDiagrams.ps1 -MarkdownFile workspace/docs/myfile.md
```

### Workflow 4: CI/CD Integration

Example GitLab CI:

```yaml
diagram-conversion:
  stage: build
  script:
    - docker network create dev-network || true
    - docker-compose -f docker-diagram-services/docker-compose.yml up -d
    - sleep 10
    - ./docker-diagram-services/scripts/process-markdown.sh docs/README.md
  artifacts:
    paths:
      - docs/*_processed.md
      - diagrams/*.png
```

### Workflow 5: VS Code Task

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Convert Current Markdown",
      "type": "shell",
      "command": "${workspaceFolder}/../docker-diagram-services/scripts/process-markdown.sh",
      "args": ["${file}"],
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Test Diagram Services",
      "type": "shell",
      "command": "${workspaceFolder}/../docker-diagram-services/scripts/test-services.sh",
      "problemMatcher": []
    }
  ]
}
```

Usage: `Ctrl+Shift+P` → "Tasks: Run Task" → Select task

## Advanced Usage

### Custom Density for SVG

Higher DPI for print quality:

```bash
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@diagram.svg" \
  -F "density=600" \
  -o high-res.png
```

### Transparent Backgrounds

Mermaid diagrams use transparent backgrounds by default.

For SVG with transparency preserved:

```bash
# Modify ImageMagick command to preserve alpha
# (requires custom modification of server.js)
```

### Batch Processing with Parallel

```bash
# Install GNU parallel
sudo apt install parallel

# Convert all SVGs in parallel
find workspace/diagrams -name "*.svg" | \
  parallel "./scripts/convert-diagram.sh svg {} {.}.png"

# Convert all Mermaid diagrams in parallel
find workspace/diagrams -name "*.mmd" | \
  parallel "./scripts/convert-diagram.sh mermaid {} {.}.png"
```

### Using from Python

```python
import requests

# Convert SVG
with open('diagram.svg', 'rb') as f:
    response = requests.post(
        'http://localhost:3000/convert/svg2png',
        files={'file': f},
        data={'density': 300}
    )
    
with open('diagram.png', 'wb') as f:
    f.write(response.content)

# Convert Mermaid
with open('diagram.mmd', 'r') as f:
    mermaid_code = f.read()
    
response = requests.post(
    'http://localhost:3000/convert/mermaid2png',
    data=mermaid_code,
    headers={'Content-Type': 'text/plain'}
)

with open('diagram.png', 'wb') as f:
    f.write(response.content)
```

## Tips and Best Practices

1. **Keep source files**: Always keep original SVG/MMD files in version control
2. **Ignore generated PNGs**: Add `*.png` to `.gitignore` for diagram directories
3. **Use meaningful names**: Name diagrams descriptively (e.g., `auth-flow.mmd`)
4. **Organize diagrams**: Keep diagrams in a dedicated directory
5. **Document diagram source**: Add comments in Mermaid files
6. **Test locally first**: Convert diagrams locally before CI/CD
7. **Monitor service health**: Check `/health` endpoint regularly
8. **Use relative paths**: Reference diagrams with relative paths in markdown

## Next Steps

- [Setup Guide](SETUP.md) - Detailed installation instructions
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Main README](../README.md) - Project overview
