# Port Configuration

## Service Ports

Both services run on the `dev-network` with different ports:

| Service | Host Port | Container Port | URL (from host) | URL (from devcontainer) |
|---------|-----------|----------------|-----------------|-------------------------|
| **Diagram Converter** | 3000 | 3000 | http://localhost:3000 | http://diagram-converter:3000 |
| **Confluence MCP** | 3001 | 3001 | http://localhost:3001 | http://confluence-mcp:3001 |

## No Port Conflicts

✅ **Different services use different ports**
- Diagram Converter: 3000
- Confluence MCP: 3001

✅ **Container networking allows name-based access**
- From devcontainers: Use container names (e.g., `http://diagram-converter:3000`)
- From host machine: Use localhost (e.g., `http://localhost:3000`)

## Access Examples

### From Your Host Machine (Windows/WSL)

```bash
# Diagram converter
curl http://localhost:3000/health

# Confluence MCP
curl http://localhost:3001/health
```

### From Any Devcontainer on dev-network

```bash
# Diagram converter
curl http://diagram-converter:3000/health

# Confluence MCP
curl http://confluence-mcp:3001/health
```

## Configuration Files

### docker-compose.yml
```yaml
services:
  diagram-converter:
    ports:
      - "3000:3000"  # Host:Container
      
  confluence-mcp:
    ports:
      - "3001:3001"  # Host:Container
    environment:
      - PORT=3001
```

### Dockerfiles
- `diagram-converter/Dockerfile`: `EXPOSE 3000`
- `confluence-mcp/Dockerfile`: `EXPOSE 3001`

## Customizing Ports

You can change the host ports via environment variables in `.env`:

```bash
# .env file
DIAGRAM_CONVERTER_PORT=3000
CONFLUENCE_MCP_PORT=3001
```

Or override when starting:

```bash
DIAGRAM_CONVERTER_PORT=8000 CONFLUENCE_MCP_PORT=8001 docker compose up -d
```

This changes the **host** ports while keeping container ports the same:
- diagram-converter: `8000:3000` (host 8000 → container 3000)
- confluence-mcp: `8001:3001` (host 8001 → container 3001)

**Note:** Devcontainers always use the container ports and names, so they're unaffected by host port changes.

## Multi-Project Setup

When running services across multiple projects, use unique container names and different host ports:

### Example: Three Projects

| Project | Container Name | Host Port | Container Port | Access from Host | Access from Network |
|---------|----------------|-----------|----------------|------------------|---------------------|
| Project A | `project-a-confluence-mcp` | 3001 | 3001 | `localhost:3001` | `project-a-confluence-mcp:3001` |
| Project B | `project-b-confluence-mcp` | 3002 | 3001 | `localhost:3002` | `project-b-confluence-mcp:3001` |
| Project C | `project-c-confluence-mcp` | 3003 | 3001 | `localhost:3003` | `project-c-confluence-mcp:3001` |

### Port Mapping Explained

```yaml
ports:
  - "3002:3001"  # HOST_PORT:CONTAINER_PORT
```

- **3002**: Port on your host machine (unique per project)
- **3001**: Port inside the container (always the same)

### Network Communication

Containers on `dev-network` communicate using:
- **Container name** (not localhost)
- **Container port** (not host port)

```bash
# ✅ Correct - from devcontainer
curl http://project-a-confluence-mcp:3001/health

# ❌ Wrong - localhost doesn't work between containers
curl http://localhost:3001/health

# ❌ Wrong - host port not visible inside network
curl http://project-a-confluence-mcp:3002/health
```

### Why This Works

**Host port conflicts prevented:**
- Each project uses different host port (3001, 3002, 3003)
- No collisions when multiple projects run simultaneously

**Container port stays consistent:**
- Application always listens on 3001 inside container
- Dockerfile `EXPOSE 3001` remains unchanged
- Network communication uses standard port

**Container names provide isolation:**
- Each project has unique container identity
- DNS resolution on `dev-network` routes correctly
- No configuration changes needed in application code
