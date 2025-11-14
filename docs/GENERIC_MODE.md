# Generic Mode - Using MCP with Multiple Confluence Instances

The Confluence MCP server supports **generic mode**, allowing you to use it with multiple Confluence instances without hardcoding credentials.

## Setup

Run the setup script and choose **No** when asked to pre-configure Confluence credentials:

```bash
./setup.sh
```

When prompted:
```
Do you want to pre-configure default Confluence credentials? (y/N): N
```

This creates a generic configuration where credentials are provided per-request.

## Usage

### Option 1: MCP Tool Call with Credentials

When calling MCP tools, provide credentials in the request:

```json
{
  "tool": "confluence_get_page",
  "arguments": {
    "pageId": "123456",
    "confluence": {
      "baseUrl": "https://company1.atlassian.net",
      "username": "user@company1.com",
      "apiToken": "your-api-token"
    }
  }
}
```

### Option 2: Environment Variables per Service

You can also set credentials via environment variables when starting the service:

```bash
docker compose up -d \
  -e CONFLUENCE_BASE_URL=https://company1.atlassian.net \
  -e CONFLUENCE_USERNAME=user@company1.com \
  -e CONFLUENCE_API_TOKEN=your-token
```

### Option 3: Multiple Project Instances

Run separate instances for different projects using unique container names:

**Project A setup:**
```yaml
# project-a/docker-compose.yml
services:
  confluence-mcp:
    container_name: ${PROJECT_NAME:-project-a}-confluence-mcp
    image: yourusername/confluence-mcp:latest
    ports:
      - "${CONFLUENCE_MCP_PORT:-3001}:3001"
    env_file: .env
    networks:
      - dev-network

networks:
  dev-network:
    external: true
```

**Project A environment (project-a/.env):**
```bash
PROJECT_NAME=project-a
CONFLUENCE_BASE_URL=https://company-a.atlassian.net
CONFLUENCE_USERNAME=user@company-a.com
CONFLUENCE_API_TOKEN=token-a
CONFLUENCE_MCP_PORT=3001
MCP_API_KEY=key-for-project-a
```

**Project B environment (project-b/.env):**
```bash
PROJECT_NAME=project-b
CONFLUENCE_BASE_URL=https://company-b.atlassian.net
CONFLUENCE_USERNAME=user@company-b.com
CONFLUENCE_API_TOKEN=token-b
CONFLUENCE_MCP_PORT=3002
MCP_API_KEY=key-for-project-b
```

**Access pattern:**
```bash
# From host
curl http://localhost:3001/health  # Project A
curl http://localhost:3002/health  # Project B

# From devcontainers on dev-network
curl http://project-a-confluence-mcp:3001/health
curl http://project-b-confluence-mcp:3001/health  # Note: container port still 3001
```

**Key points:**
- Each project gets unique container name: `${PROJECT_NAME}-confluence-mcp`
- Different host ports avoid conflicts: 3001, 3002, 3003, etc.
- Container port stays 3001 inside each container
- All share `dev-network` for inter-container communication
- Isolated configurations via project-specific `.env` files

## Benefits of Generic Mode

- ✅ Use with multiple Confluence instances
- ✅ No hardcoded credentials in configuration
- ✅ Switch between different Confluence servers easily
- ✅ Better security - credentials passed per-request
- ✅ Ideal for multi-tenant or agency use cases

## API Token Generation

Generate API tokens for each Confluence instance:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a descriptive name (e.g., "MCP Server - Company1")
4. Copy the token and store it securely

## Security Notes

- Never commit credentials to version control
- Use environment variables or secure credential stores
- Rotate API tokens regularly
- Use different tokens for different environments (dev/staging/prod)
