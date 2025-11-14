# Getting Started - Quick Walkthrough

Welcome! This guide will walk you through setting up and using the Docker Diagram Services in 15 minutes.

## 🎯 What You'll Learn

1. Extract and set up the project
2. Start the services
3. Convert your first diagram
4. Process a markdown document
5. Verify everything works

## 📋 Prerequisites Check

Before starting, verify you have:

```bash
# Docker
docker --version
# Should show: Docker version 20.x or higher

# Git
git --version
# Should show: git version 2.x or higher

# Curl (optional, for testing)
curl --version
```

If any are missing, see [detailed setup instructions](docs/SETUP.md).

## 🚀 5-Minute Setup

### Step 1: Extract the Project (30 seconds)

```bash
# Navigate to your home directory
cd ~

# Extract the zip file
unzip docker-diagram-services.zip

# Enter the project
cd docker-diagram-services

# Verify structure
ls -la
# You should see: setup.sh, docker-compose.yml, scripts/, etc.
```

### Step 2: Run the Setup Script (2 minutes)

```bash
# Make setup script executable
chmod +x setup.sh

# Run setup (will prompt for Confluence credentials)
./setup.sh
```

The script will ask:
1. **Pre-configure Confluence credentials?** (y/N)
   - **Yes**: Set default credentials for single Confluence instance
   - **No**: Generic mode - provide credentials per-request (multi-instance support)

If you chose **Yes**, provide:
1. **Confluence URL**: `https://yourcompany.atlassian.net`
2. **Your email**: `you@company.com`
3. **API Token**: Generate at https://id.atlassian.com/manage-profile/security/api-tokens

Always provides:
- **MCP API Key**: Auto-generated secure random key

### Step 3: Verify Services Started (30 seconds)

```bash
# Check services are running
docker-compose ps

# Should show:
# NAME                STATUS      PORTS
# diagram-converter   Up          0.0.0.0:3000->3000/tcp
# confluence-mcp      Up          0.0.0.0:3001->3001/tcp

# Test health
curl http://localhost:3000/health
# Should return JSON with "status": "ok"
```

## ✅ First Conversions

### Test 1: Convert SVG to PNG (1 minute)

```bash
# Use the included test SVG
./scripts/convert-diagram.sh svg \
  workspace/diagrams/test.svg \
  workspace/diagrams/my-first-conversion.png

# Check the output
ls -lh workspace/diagrams/my-first-conversion.png

# View it (from Windows)
# Open: \\wsl$\Ubuntu-24.04\home\yourusername\docker-diagram-services\workspace\diagrams\my-first-conversion.png
```

### Test 2: Convert Mermaid to PNG (1 minute)

```bash
# Use the included test Mermaid diagram
./scripts/convert-diagram.sh mermaid \
  workspace/diagrams/test.mmd \
  workspace/diagrams/my-mermaid-output.png

# Check the output
ls -lh workspace/diagrams/my-mermaid-output.png
```

### Test 3: Process Complete Markdown (1 minute)

```bash
# Process the example markdown
./scripts/process-markdown.sh workspace/docs/example.md

# This creates: workspace/docs/example_processed.md
# Check the processed file
cat workspace/docs/example_processed.md

# Notice: .svg and .mmd references are now .png
```

## 🎨 Create Your Own

### Create a Custom SVG (2 minutes)

```bash
# Create a simple SVG
cat > workspace/diagrams/my-diagram.svg << 'EOF'
<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="300" height="200" fill="#f0f0f0"/>
  <circle cx="150" cy="100" r="60" fill="#4CAF50"/>
  <text x="150" y="110" text-anchor="middle" font-size="20" fill="white">
    Hello!
  </text>
</svg>
EOF

# Convert it
./scripts/convert-diagram.sh svg \
  workspace/diagrams/my-diagram.svg \
  workspace/diagrams/my-diagram.png
```

### Create a Custom Mermaid Diagram (2 minutes)

```bash
# Create a flowchart
cat > workspace/diagrams/my-flow.mmd << 'EOF'
graph TD
    Start[Start] --> Input[Get Input]
    Input --> Process{Valid?}
    Process -->|Yes| Save[Save Data]
    Process -->|No| Error[Show Error]
    Save --> Success[Success!]
    Error --> Input
    Success --> End[End]
    
    style Start fill:#4CAF50,color:#fff
    style Success fill:#4CAF50,color:#fff
    style Error fill:#f44336,color:#fff
EOF

# Convert it
./scripts/convert-diagram.sh mermaid \
  workspace/diagrams/my-flow.mmd \
  workspace/diagrams/my-flow.png
```

### Create a Document with Your Diagrams (3 minutes)

```bash
# Create a markdown document
cat > workspace/docs/my-guide.md << 'EOF'
# My Technical Guide

## Architecture

Here's our system architecture:

![Architecture](../diagrams/my-diagram.svg)

## Process Flow

This flowchart shows our main process:

![Process Flow](../diagrams/my-flow.mmd)

## Summary

Both diagrams will be converted to PNG when processed!
EOF

# Process the document
./scripts/process-markdown.sh workspace/docs/my-guide.md

# Check the result
cat workspace/docs/my-guide_processed.md
# Notice: diagrams are now referenced as .png files
```

## 🎓 What You've Learned

✅ Set up Docker services  
✅ Converted SVG to PNG  
✅ Converted Mermaid to PNG  
✅ Processed markdown with diagrams  
✅ Created custom diagrams  

## 🔍 Verify Everything Works

Run the complete test suite:

```bash
./scripts/test-services.sh
```

This shows:
- ✅ Service health
- ✅ Container status
- ✅ Network configuration
- ✅ Resource usage

## 📚 Next Steps

### Learn More

- **[Usage Guide](docs/USAGE.md)** - Complete usage documentation
- **[Setup Guide](docs/SETUP.md)** - Detailed setup instructions
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions to common issues

### Common Tasks

**Start services**:
```bash
docker-compose up -d
```

**Stop services**:
```bash
docker-compose stop
```

**View logs**:
```bash
docker-compose logs -f
```

**Convert a diagram**:
```bash
./scripts/convert-diagram.sh [svg|mermaid] <input> <output>
```

**Process markdown**:
```bash
./scripts/process-markdown.sh <markdown-file>
```

### Integration Options

**Use in VS Code devcontainers**:
Add to `.devcontainer/devcontainer.json`:
```json
{
  "runArgs": ["--network=dev-network"]
}
```

**Use with AI agents**:
Configure MCP in your AI assistant to automate conversions.

**Use in scripts**:
Call the HTTP API from any language:
```bash
curl -X POST http://localhost:3000/convert/svg2png -F "file=@diagram.svg" -o output.png
```

## 🆘 Having Issues?

**Services won't start?**
```bash
sudo systemctl start docker
docker network create dev-network
./setup.sh
```

**Conversion fails?**
```bash
# Check service is running
curl http://localhost:3000/health

# View logs
docker logs diagram-converter
```

**Need help?**
Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

## 🎉 You're Ready!

You now have a complete diagram conversion system running!

- Services run automatically in Docker
- Convert diagrams with simple scripts
- Process entire markdown documents
- Integrate with your workflows

Enjoy your automated diagram pipeline! 🚀
