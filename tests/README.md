# UtilityContainers Test Suite

This directory contains test scripts to verify that the MCP servers are working correctly and exposing the expected tools to GitHub Copilot and other MCP clients.

## Setup

### 1. Install dependencies:

```bash
cd tests
npm install
```

### 2. Configure environment variables

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set your Confluence credentials:

```env
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=YOUR_SPACE
```

**Note:** The `.env` file is gitignored to prevent exposing secrets. Never commit credentials to the repository.

**Getting your Confluence API token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and paste it in your `.env` file

## Test Scripts

### 1. Test MCP Tools Discovery

Tests that the MCP server is exposing the correct tools to Copilot:

```bash
npm run test:mcp-tools
```

**What it does:**
- Connects to the MCP server via SSE
- Establishes an authenticated session
- Requests the list of available tools
- Displays all tools with their descriptions and parameters

**Expected output:**
```
✅ Health check passed
✅ SSE connection established
🔗 Session ID: <uuid>
📋 Available Tools:
   1. confluence_list_spaces
   2. confluence_list_pages
   3. confluence_create_page
   ... (8 tools total)
🎉 All tests passed!
```

### 2. Test MCP Connection Lifecycle

Tests the full MCP connection protocol:

```bash
npm run test:mcp-connection
```

**What it does:**
- Performs a health check
- Establishes an SSE connection
- Initializes the MCP protocol with version negotiation
- Lists available tools
- Verifies server capabilities

**Expected output:**
```
✅ Health check passed
✅ SSE connection established
✅ Initialization successful
   Server info: { name: 'confluence-mcp', version: '0.1.0' }
   Capabilities: [ 'tools', 'logging' ]
✅ Found 8 tools
🎉 All connection tests passed!
```

### 3. Run All Tests

Run all test scripts sequentially:

```bash
npm run test:all
```

## Environment Variables

- `MCP_SERVER_URL`: URL of the MCP server (default: `http://localhost:3001`)
- `MCP_API_KEY`: API key for authentication (default: value from .env file)

**Example:**

```bash
MCP_SERVER_URL=http://localhost:3001 npm run test:mcp-tools
```

## Test Results Summary

### Confluence MCP Server

The tests verify that the confluence-mcp server successfully exposes **8 tools** to GitHub Copilot:

1. **confluence_list_spaces** - List all available Confluence spaces
2. **confluence_list_pages** - List pages in a specific space (requires: spaceKey)
3. **confluence_create_page** - Create new pages from Markdown (requires: title, markdownContent, spaceKey)
4. **confluence_update_page** - Update existing pages (requires: pageId, title, markdownContent)
5. **confluence_delete_page** - Delete pages and clean up cache (requires: pageId)
6. **confluence_setup_project** - Configure project-specific settings (requires: confluenceUrl, username, apiToken, spaceKey)
7. **confluence_show_config** - Display current configuration
8. **confluence_test_connection** - Test Confluence API connectivity

### MCP Protocol Compliance

✅ **SSE Transport**: Server correctly implements Server-Sent Events transport
✅ **Authentication**: Validates `x-mcp-api-key` header on all requests  
✅ **Session Management**: Generates unique session IDs for each connection
✅ **JSON-RPC 2.0**: Properly handles requests and responses
✅ **Protocol Version**: Supports MCP protocol version `2024-11-05`
✅ **Capabilities**: Exposes `tools` and `logging` capabilities

## Troubleshooting

### Connection Refused

**Error:** `ECONNREFUSED` when connecting to localhost:3001

**Solution:**
1. Ensure the MCP server container is running:
   ```bash
   docker ps | grep confluence-mcp
   ```
2. Start the container if needed:
   ```bash
   docker-compose up -d confluence-mcp
   ```

### Unauthorized (401)

**Error:** `Unauthorized` or `401` response

**Solution:**
1. Check that `MCP_API_KEY` is set in the `.env` file
2. Verify the API key matches in both the container and test scripts
3. Check container logs:
   ```bash
   docker logs confluence-mcp
   ```

### Timeout Errors

**Error:** `Test timeout after 15 seconds`

**Solution:**
1. Check server logs for errors:
   ```bash
   docker logs confluence-mcp
   ```
2. Verify the server is responding to health checks:
   ```bash
   curl http://localhost:3001/health
   ```
3. Ensure SSE connection can be established:
   ```bash
   curl -N -H "x-mcp-api-key: <your-key>" http://localhost:3001/mcp
   ```

### No Tools Found

**Error:** `No tools found in response`

**Solution:**
1. Verify the server initialized correctly (check logs)
2. Ensure the Confluence MCP server built successfully
3. Rebuild the container if needed:
   ```bash
   docker-compose build confluence-mcp
   docker-compose up -d confluence-mcp
   ```

## Technical Details

### SSE Message Flow

1. **Client → Server**: `GET /mcp` with `x-mcp-api-key` header
2. **Server → Client**: `event: endpoint` with session ID
3. **Client → Server**: `POST /messages?sessionId=<id>` with JSON-RPC request
4. **Server → Client**: `event: message` with JSON-RPC response via SSE stream

### Authentication

All requests require the `x-mcp-api-key` header:
```http
x-mcp-api-key: <your-api-key>
```

The API key is configured in the `.env` file and passed to the container via environment variables.

## Integration with GitHub Copilot

These tests verify that the MCP server correctly exposes tools that GitHub Copilot can use. When properly configured in VS Code or your project, Copilot will:

1. Connect to the MCP server via SSE
2. Discover available tools automatically
3. Use these tools to interact with Confluence
4. Create, update, and manage Confluence pages from your code/documentation

See the main project documentation for instructions on configuring GitHub Copilot to use this MCP server.
