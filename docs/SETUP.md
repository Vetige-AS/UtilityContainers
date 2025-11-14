# Detailed Setup Guide

This guide provides comprehensive setup instructions for the Docker Diagram Services.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Building Services](#building-services)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **WSL2** with Ubuntu 24.04
- **Docker** (CLI only, no Desktop required)
- **Node.js 20** (used in containers - base images handle this)
- **Git** for cloning repositories
- **curl** and **jq** for testing (optional but recommended)

### Installing Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io -y

# Install Git
sudo apt install git -y

# Install testing tools
sudo apt install curl jq -y

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (avoid sudo)
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify
docker --version
git --version
```

## Initial Setup

### Step 1: Extract Project

```bash
# Navigate to your home directory
cd ~

# Extract the zip file (if you downloaded it)
unzip docker-diagram-services.zip

# Or clone from repository (if available)
# git clone <repository-url> docker-diagram-services

# Navigate to project
cd docker-diagram-services
```

### Step 2: Make Scripts Executable

```bash
chmod +x setup.sh
chmod +x scripts/*.sh
```

### Step 3: Create Docker Network

```bash
# Create the network for container communication
docker network create dev-network

# Verify
docker network ls | grep dev-network
```

## Configuration

### Confluence Credentials

You have two options:

#### Option A: Pre-configured (Single Instance)

Provide credentials during setup for one default Confluence instance:

1. **Confluence Base URL**: Your Atlassian Confluence URL
   - Format: `https://yourcompany.atlassian.net`
   - Find it in your browser when accessing Confluence

2. **Username**: Your Atlassian account email
   - The email you use to log into Confluence

3. **API Token**: Generate a new token
   - Visit: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Give it a name (e.g., "Docker Diagram Services")
   - Copy the token (you won't see it again!)

#### Option B: Generic Mode (Multiple Instances)

Skip credential setup during installation. Provide credentials:
- Per-request via MCP tool arguments
- Per-container via environment variables
- Per-project via `.env` files

**Best for:**
- Multiple Confluence instances
- Different credentials per project
- Agency/consulting work with multiple clients

See [Generic Mode Guide](GENERIC_MODE.md) for details.

### Creating Environment File

#### Option 1: Use Setup Script (Recommended)

```bash
./setup.sh
```

The script will prompt you for all required values.

#### Option 2: Manual Configuration

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

Edit the following values:
```bash
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
CONFLUENCE_USERNAME=your.email@company.com
CONFLUENCE_API_TOKEN=your_api_token_here
MCP_API_KEY=choose_a_random_secure_string
```

### Verifying Configuration

```bash
# Check that .env file exists and has values
cat .env | grep -v "^#"
```

## Building Services

### Build All Services

```bash
# Build using docker-compose
docker-compose build

# This will:
# - Build diagram-converter service
# - Clone and build confluence-mcp service
# - Download all dependencies
```

Build time: 5-10 minutes on first run (depends on internet speed)

### Build Individual Services

If needed, you can build services separately:

```bash
# Diagram Converter
cd diagram-converter
docker build -t diagram-converter:latest .
cd ..

# Confluence MCP (after cloning)
cd confluence-mcp
docker build -t confluence-mcp:latest .
cd ..
```

## Starting Services

### Start All Services

```bash
# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop following logs: Ctrl+C
```

### Start Individual Services

```bash
# Start only diagram-converter
docker-compose up -d diagram-converter

# Start only confluence-mcp
docker-compose up -d confluence-mcp
```

## Verification

### Check Service Status

```bash
# View running containers
docker-compose ps

# Should show:
# NAME                STATUS      PORTS
# diagram-converter   Up          0.0.0.0:3000->3000/tcp
# confluence-mcp      Up          0.0.0.0:3001->3001/tcp
```

### Test Services

```bash
# Run test script
./scripts/test-services.sh

# Manual tests
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### Test Diagram Conversion

```bash
# Test SVG conversion
./scripts/convert-diagram.sh svg workspace/diagrams/test.svg workspace/diagrams/test-output.png

# Test Mermaid conversion
./scripts/convert-diagram.sh mermaid workspace/diagrams/test.mmd workspace/diagrams/test-mermaid-output.png

# Check output files
ls -lh workspace/diagrams/*.png
```

## Troubleshooting

### Services Won't Start

**Check Docker is running:**
```bash
sudo systemctl status docker
sudo systemctl start docker
```

**Check for port conflicts:**
```bash
sudo lsof -i :3000
sudo lsof -i :3001

# Or
sudo netstat -tlnp | grep :3000
```

**View detailed logs:**
```bash
docker-compose logs diagram-converter
docker-compose logs confluence-mcp
```

### Network Issues

**Recreate network:**
```bash
docker-compose down
docker network rm dev-network
docker network create dev-network
docker-compose up -d
```

**Check network connectivity:**
```bash
# Inspect network
docker network inspect dev-network

# Test connectivity between containers
docker exec diagram-converter ping confluence-mcp -c 3
```

### Build Failures

**Clear Docker cache and rebuild:**
```bash
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

**Check disk space:**
```bash
df -h
docker system df
```

### Confluence MCP Issues

**Verify credentials:**
```bash
# Check .env file
cat confluence-mcp/.env

# Test API token manually
curl -u your-email@example.com:your-api-token \
  https://your-domain.atlassian.net/wiki/rest/api/space
```

**Rebuild confluence-mcp:**
```bash
cd confluence-mcp
docker build -t confluence-mcp:latest --no-cache .
```

## Advanced Configuration

### Custom Ports

Edit `docker-compose.yml`:
```yaml
services:
  diagram-converter:
    ports:
      - "3000:3000"  # Change first number: "HOST:CONTAINER"
```

Or use `.env`:
```bash
DIAGRAM_CONVERTER_PORT=3000
CONFLUENCE_MCP_PORT=3001
```

### Resource Limits

Add to `docker-compose.yml`:
```yaml
services:
  diagram-converter:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

### Persistent Storage

The workspace directory is already mounted:
```yaml
volumes:
  - ./workspace:/workspace
```

Add more volumes as needed:
```yaml
volumes:
  - ./my-docs:/app/docs
  - ./my-diagrams:/app/diagrams
```

## Auto-Start on Boot

### Option 1: Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/docker-diagrams.service
```

Add:
```ini
[Unit]
Description=Docker Diagram Services
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USERNAME/docker-diagram-services
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=YOUR_USERNAME

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable docker-diagrams
sudo systemctl start docker-diagrams
```

### Option 2: Add to .bashrc

```bash
echo 'cd ~/docker-diagram-services && ./scripts/start-services.sh' >> ~/.bashrc
```

## Next Steps

- [Usage Guide](USAGE.md) - Learn how to use the services
- [Troubleshooting](TROUBLESHOOTING.md) - Solutions to common problems
- [Main README](../README.md) - Overview and quick start

## Support

If you encounter issues:

1. Check logs: `docker-compose logs`
2. Review [Troubleshooting Guide](TROUBLESHOOTING.md)
3. Verify configuration: `./scripts/test-services.sh`
4. Check Docker: `docker ps` and `docker network ls`
