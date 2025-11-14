# Troubleshooting Guide

Solutions to common problems with Docker Diagram Services.

## Table of Contents

1. [Service Issues](#service-issues)
2. [Network Problems](#network-problems)
3. [Conversion Errors](#conversion-errors)
4. [Performance Issues](#performance-issues)
5. [Confluence MCP Issues](#confluence-mcp-issues)

## Service Issues

### Services Won't Start

**Symptom**: `docker-compose up -d` fails or services don't appear in `docker ps`

**Solutions**:

```bash
# Check Docker is running
sudo systemctl status docker
sudo systemctl start docker

# Check for errors in logs
docker-compose logs

# Try rebuilding
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check for port conflicts
sudo lsof -i :3000
sudo lsof -i :3001
```

### Services Keep Restarting

**Symptom**: `docker ps` shows services constantly restarting

**Solutions**:

```bash
# View logs to see error
docker-compose logs --tail=50 diagram-converter
docker-compose logs --tail=50 confluence-mcp

# Common causes:
# 1. Missing dependencies - Rebuild: docker-compose build --no-cache
# 2. Invalid configuration - Check .env file
# 3. Permission issues - Check file permissions

# Restart with verbose logging
docker-compose up
```

### Health Check Failures

**Symptom**: Container shows as unhealthy

**Solutions**:

```bash
# Check health manually
curl http://localhost:3000/health

# View container logs
docker logs diagram-converter

# Inspect health check
docker inspect diagram-converter | grep -A 10 Health

# Temporarily disable health check in docker-compose.yml
# Comment out the healthcheck section
```

### Cannot Access Services

**Symptom**: `curl http://localhost:3000/health` fails with connection refused

**Solutions**:

```bash
# Check if container is running
docker ps | grep diagram-converter

# Check port mapping
docker port diagram-converter

# Try from inside container
docker exec diagram-converter wget -O- http://localhost:3000/health

# Check firewall (WSL)
# WSL usually doesn't have firewall issues, but check:
sudo iptables -L

# Try different port (edit docker-compose.yml)
# Change "3000:3000" to "3001:3000"
```

## Network Problems

### Containers Can't Communicate

**Symptom**: One container cannot reach another by name

**Solutions**:

```bash
# Verify network exists
docker network ls | grep dev-network

# Inspect network
docker network inspect dev-network

# Check both containers are on the network
docker network inspect dev-network | grep -A 5 Containers

# Recreate network
docker-compose down
docker network rm dev-network
docker network create dev-network
docker-compose up -d

# Test connectivity
docker exec diagram-converter ping confluence-mcp -c 3
```

### Network Already Exists Error

**Symptom**: `Error: network dev-network already exists`

**Solutions**:

```bash
# Option 1: Use existing network
# Change docker-compose.yml:
# networks:
#   dev-network:
#     external: true

# Option 2: Remove and recreate
docker-compose down
docker network rm dev-network
./setup.sh
```

### DNS Resolution Fails

**Symptom**: Container can't resolve names

**Solutions**:

```bash
# Check DNS from inside container
docker exec diagram-converter cat /etc/resolv.conf

# Try explicit DNS in docker-compose.yml
services:
  diagram-converter:
    dns:
      - 8.8.8.8
      - 8.8.4.4

# Restart Docker daemon
sudo systemctl restart docker
```

## Conversion Errors

### SVG Conversion Fails

**Symptom**: `convert: no decode delegate for this image format`

**Solutions**:

```bash
# Check SVG is valid
xmllint --noout workspace/diagrams/test.svg

# Try simpler SVG
cat > test-simple.svg << 'EOF'
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>
EOF

# Test conversion
./scripts/convert-diagram.sh svg test-simple.svg test-simple.png

# Check ImageMagick in container
docker exec diagram-converter convert --version

# Rebuild container if needed
docker-compose build --no-cache diagram-converter
```

### Mermaid Conversion Fails

**Symptom**: `Error: Failed to launch the browser process`

**Solutions**:

```bash
# Check Mermaid syntax
# Use Mermaid Live Editor: https://mermaid.live

# Check Chromium in container
docker exec diagram-converter chromium-browser --version

# Try with simpler diagram
cat > test-simple.mmd << 'EOF'
graph LR
    A --> B
EOF

./scripts/convert-diagram.sh mermaid test-simple.mmd test-simple.png

# Check container logs
docker logs diagram-converter --tail=50

# Common Mermaid issues:
# - Invalid syntax
# - Missing quotes in labels
# - Unsupported diagram type
```

### "No space left on device"

**Symptom**: Conversion fails with disk space error

**Solutions**:

```bash
# Check disk space
df -h

# Check Docker disk usage
docker system df

# Clean up Docker
docker system prune -a

# Clean up specific items
docker image prune -a
docker volume prune
docker container prune

# Check /tmp space (used for conversions)
docker exec diagram-converter df -h /tmp
```

### Large Files Fail

**Symptom**: Large diagrams fail to convert or timeout

**Solutions**:

```bash
# Increase timeout in server.js (requires rebuild)
# Or split into smaller diagrams

# Check container resources
docker stats diagram-converter

# Increase memory limit in docker-compose.yml:
services:
  diagram-converter:
    deploy:
      resources:
        limits:
          memory: 2G

# Restart services
docker-compose up -d
```

## Performance Issues

### Slow Conversions

**Symptom**: Conversions take a very long time

**Solutions**:

```bash
# Check container resources
docker stats

# Check WSL2 resources
# Edit C:\Users\YourName\.wslconfig
# Add:
# [wsl2]
# memory=4GB
# processors=2

# Restart WSL
wsl --shutdown

# Optimize Chromium for Mermaid
# Edit diagram-converter/server.js
# Add --no-sandbox flag to mmdc

# Use lower DPI for testing
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@diagram.svg" \
  -F "density=150" \
  -o output.png
```

### High Memory Usage

**Symptom**: Container uses too much memory

**Solutions**:

```bash
# Check current usage
docker stats --no-stream

# Set memory limits in docker-compose.yml
services:
  diagram-converter:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

# Restart with limits
docker-compose up -d

# Monitor memory
watch -n 1 'docker stats --no-stream'
```

### Container Crashes

**Symptom**: Container stops unexpectedly

**Solutions**:

```bash
# Check exit code
docker inspect diagram-converter | grep ExitCode

# View logs before crash
docker logs --tail=100 diagram-converter

# Check for OOM (Out of Memory)
dmesg | grep -i "out of memory"

# Increase memory if OOM
# See "High Memory Usage" above

# Check for segfaults
docker logs diagram-converter 2>&1 | grep -i segfault
```

## Confluence MCP Issues

### Cannot Clone Repository

**Symptom**: `git clone` fails during setup

**Solutions**:

```bash
# Check internet connection
ping github.com

# Try with verbose
git clone https://github.com/manateeit/confluence-mcp.git --verbose

# Try SSH instead
git clone git@github.com:manateeit/confluence-mcp.git

# Manual download
cd confluence-mcp
wget https://github.com/manateeit/confluence-mcp/archive/refs/heads/main.zip
unzip main.zip
mv confluence-mcp-main/* .
```

### Build Fails

**Symptom**: Confluence MCP docker build fails

**Solutions**:

```bash
# Check Dockerfile exists
ls confluence-mcp/Dockerfile

# If not, use template
cp confluence-mcp/Dockerfile.template confluence-mcp/Dockerfile

# Try build with verbose
cd confluence-mcp
docker build -t confluence-mcp:latest . --progress=plain

# Check for missing dependencies in package.json
cat package.json

# Try with Node 18 instead of 20
# Edit Dockerfile: FROM node:18-alpine
```

### API Authentication Fails

**Symptom**: 401 Unauthorized errors

**Solutions**:

```bash
# Verify credentials
cat .env | grep CONFLUENCE

# Test API token manually
curl -u your-email@domain.com:your-api-token \
  https://your-domain.atlassian.net/wiki/rest/api/space \
  -v

# Generate new API token
# Visit: https://id.atlassian.com/manage-profile/security/api-tokens

# Update .env with new token
nano .env

# Restart service
docker-compose restart confluence-mcp
```

### MCP Connection Issues

**Symptom**: AI assistant can't connect to MCP server

**Solutions**:

```bash
# Check service is running
curl http://localhost:3001/health || echo "Service not responding"

# Check MCP endpoint
curl -v http://localhost:3001/mcp

# Verify configuration in AI assistant config
# For Claude Desktop: ~/.config/claude/config.json

# Try localhost vs 127.0.0.1
# Try with explicit port

# Check firewall (rare in WSL)
sudo iptables -L

# View MCP server logs
docker logs confluence-mcp --tail=50 -f
```

## General Debugging Tips

### Enable Debug Logging

```bash
# Add to docker-compose.yml
services:
  diagram-converter:
    environment:
      - DEBUG=*
      - NODE_ENV=development

# Restart
docker-compose up -d
```

### Interactive Container Shell

```bash
# Enter container
docker exec -it diagram-converter sh

# Check environment
env

# Test commands manually
convert --version
mmdc --version
node --version

# Test API from inside
wget -O- http://localhost:3000/health
```

### Complete Reset

```bash
# Stop everything
docker-compose down

# Remove containers
docker rm -f diagram-converter confluence-mcp

# Remove images
docker rmi diagram-converter confluence-mcp

# Remove network
docker network rm dev-network

# Clean Docker
docker system prune -a

# Start fresh
./setup.sh
```

### Check Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs diagram-converter
docker-compose logs confluence-mcp

# Follow logs
docker-compose logs -f

# Last N lines
docker-compose logs --tail=50

# With timestamps
docker-compose logs --timestamps
```

## Getting Help

If you still have issues:

1. **Collect information**:
   ```bash
   # Save logs
   docker-compose logs > logs.txt
   
   # Save configuration
   docker-compose config > config.txt
   
   # Save system info
   docker version > system-info.txt
   docker info >> system-info.txt
   uname -a >> system-info.txt
   ```

2. **Check documentation**:
   - [Setup Guide](SETUP.md)
   - [Usage Guide](USAGE.md)
   - [Main README](../README.md)

3. **Common mistakes**:
   - Forgot to run `chmod +x scripts/*.sh`
   - Network not created: `docker network create dev-network`
   - .env file not configured
   - Services not started: `docker-compose up -d`

## Quick Reference

**Start services**: `docker-compose up -d`  
**Stop services**: `docker-compose stop`  
**View logs**: `docker-compose logs -f`  
**Restart service**: `docker-compose restart diagram-converter`  
**Rebuild service**: `docker-compose build --no-cache diagram-converter`  
**Check health**: `curl http://localhost:3000/health`  
**Test conversion**: `./scripts/test-services.sh`  
**Complete reset**: `docker-compose down && docker system prune -a`
