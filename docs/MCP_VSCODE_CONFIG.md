# VS Code MCP Server Configuration Endpoint

The Confluence MCP server provides a `/mcp/vscode` endpoint that generates VS Code MCP server configuration automatically.

## Endpoint

**URL**: `GET /mcp/vscode`

**Query Parameters**:
- `devcontainer` (boolean): Set to `true` for devcontainer configuration
- `project` (string): Project name for multi-project setups

**Response Formats**:
- **JSON** (with `Accept: application/json` header): Returns structured config + instructions
- **Markdown** (default): Returns complete setup guide with embedded JSON

## Quick Setup

### For Host Machine (localhost)

```bash
# Fetch configuration
curl http://localhost:3001/mcp/vscode > mcp-config-guide.md

# Or get JSON config directly
curl -H "Accept: application/json" http://localhost:3001/mcp/vscode > mcp-config.json
```

### For Devcontainer

```bash
# Fetch devcontainer-specific configuration
curl http://localhost:3001/mcp/vscode?devcontainer=true > mcp-config-guide.md
```

### For Multi-Project Setup

```bash
# Project A (port 3001)
curl http://localhost:3001/mcp/vscode?project=project-a > .vscode/mcp-project-a.md

# Project B (port 3002)
curl http://localhost:3002/mcp/vscode?project=project-b > .vscode/mcp-project-b.md
```

## Response Structure (JSON)

```json
{
  "config": {
    "mcpServers": {
      "confluence": {
        "url": "http://localhost:3001/mcp",
        "transport": {
          "type": "sse"
        },
        "headers": {
          "x-mcp-api-key": "${MCP_API_KEY}"
        },
        "description": "Confluence MCP (localhost)",
        "tools": [
          "confluence_setup_project",
          "confluence_test_connection",
          "confluence_show_config",
          "confluence_list_spaces",
          "confluence_list_pages",
          "confluence_create_page",
          "confluence_update_page",
          "confluence_delete_page"
        ]
      }
    }
  },
  "instructions": "...",
  "serverUrl": "http://localhost:3001/mcp",
  "apiKeyPlaceholder": "${MCP_API_KEY}",
  "context": {
    "isDevcontainer": false,
    "projectName": "",
    "host": "localhost:3001"
  }
}
```

## VS Code Settings Integration

### Manual Integration

Add the `mcpServers` configuration to your VS Code settings:

**Workspace settings** (`.vscode/settings.json`):
```json
{
  "mcp": {
    "servers": {
      "confluence": {
        "url": "http://localhost:3001/mcp",
        "transport": {
          "type": "sse"
        },
        "headers": {
          "x-mcp-api-key": "${MCP_API_KEY}"
        },
        "description": "Confluence MCP (localhost)"
      }
    }
  }
}
```

## How MCP Works

**Transport: Server-Sent Events (SSE)**
- HTTP-based persistent connection for real-time updates
- Server pushes updates to VS Code as they happen
- Standard web technology, works through firewalls

**Tool Discovery: Automatic**
- MCP servers advertise their tools via the protocol
- VS Code queries the server for available tools on connection
- No need to manually list tools in configuration
- Tools update automatically when server capabilities change

**Authentication: API Key Header**
- `x-mcp-api-key` header included with each request
- Validates client has permission to use the MCP server
- Use environment variables to keep keys secure

**User settings** (`~/.vscode/settings.json` or `%APPDATA%\Code\User\settings.json`):
Same format, but available globally across all projects.

### Automated Integration Script

**setup-mcp.sh**:
```bash
#!/bin/bash
# Automated VS Code MCP configuration

PROJECT_NAME=${PROJECT_NAME:-""}
IS_DEVCONTAINER=${IS_DEVCONTAINER:-false}
MCP_PORT=${CONFLUENCE_MCP_PORT:-3001}

# Determine URL
if [ "$IS_DEVCONTAINER" = "true" ]; then
    CONTAINER_NAME="${PROJECT_NAME:+$PROJECT_NAME-}confluence-mcp"
    BASE_URL="http://${CONTAINER_NAME}:3001"
else
    BASE_URL="http://localhost:${MCP_PORT}"
fi

# Create .vscode directory
mkdir -p .vscode

# Fetch configuration
echo "Fetching MCP configuration from ${BASE_URL}/mcp/vscode..."
PARAMS=""
[ "$IS_DEVCONTAINER" = "true" ] && PARAMS="?devcontainer=true"
[ -n "$PROJECT_NAME" ] && PARAMS="${PARAMS:+$PARAMS&}project=${PROJECT_NAME}"

curl -f "${BASE_URL}/mcp/vscode${PARAMS}" -H "Accept: application/json" > /tmp/mcp-config.json

if [ $? -eq 0 ]; then
    echo "✅ MCP configuration fetched successfully"
    
    # Extract just the mcpServers config
    # Note: Requires jq or manual extraction
    echo "📝 Add the following to .vscode/settings.json:"
    echo ""
    cat /tmp/mcp-config.json
    echo ""
    echo "⚠️  Don't forget to set MCP_API_KEY environment variable"
else
    echo "❌ Failed to fetch MCP configuration"
    echo "   Make sure the MCP server is running on port ${MCP_PORT}"
    exit 1
fi
```

### DevContainer Integration

**`.devcontainer/devcontainer.json`**:
```json
{
  "name": "My Project",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "app",
  "runServices": ["confluence-mcp", "diagram-converter"],
  
  "postCreateCommand": "bash .devcontainer/setup-mcp.sh",
  
  "customizations": {
    "vscode": {
      "settings": {
        "mcp": {
          "servers": {
            "confluence": {
              "url": "http://confluence-mcp:3001/mcp",
              "transport": {
                "type": "sse"
              },
              "headers": {
                "x-mcp-api-key": "${env:MCP_API_KEY}"
              },
              "description": "Confluence MCP"
            }
          }
        }
      }
    }
  },
  
  "containerEnv": {
    "MCP_API_KEY": "${localEnv:MCP_API_KEY}"
  }
}
```

**`.devcontainer/setup-mcp.sh`**:
```bash
#!/bin/bash
# Fetch latest MCP configuration for devcontainer

curl http://confluence-mcp:3001/mcp/vscode?devcontainer=true \
  -H "Accept: application/json" \
  -o .vscode/mcp-config.json

echo "✅ MCP configuration updated in .vscode/mcp-config.json"
echo "   Reload VS Code window to apply changes"
```

## Environment Variables

The configuration uses `${MCP_API_KEY}` placeholder which VS Code will substitute with the environment variable.

### Set MCP_API_KEY

**Linux/macOS** (`~/.bashrc`, `~/.zshrc`):
```bash
export MCP_API_KEY="your-api-key-here"
```

**Windows** (PowerShell):
```powershell
$env:MCP_API_KEY = "your-api-key-here"
# Or set permanently:
[System.Environment]::SetEnvironmentVariable('MCP_API_KEY', 'your-api-key-here', 'User')
```

**Get API key from .env**:
```bash
cat .env | grep MCP_API_KEY
```

**Generate new API key**:
```bash
openssl rand -hex 32
```

## Multi-Project Configuration

For multiple projects with separate Confluence instances:

### Project A
```bash
# Start on port 3001
PROJECT_NAME=project-a CONFLUENCE_MCP_PORT=3001 docker compose up -d

# Get config
curl http://localhost:3001/mcp/vscode?project=project-a \
  -H "Accept: application/json" > .vscode/mcp-project-a.json
```

### Project B
```bash
# Start on port 3002
PROJECT_NAME=project-b CONFLUENCE_MCP_PORT=3002 docker compose up -d

# Get config
curl http://localhost:3002/mcp/vscode?project=project-b \
  -H "Accept: application/json" > .vscode/mcp-project-b.json
```

### Merge Configurations

**`.vscode/settings.json`**:
```json
{
  "mcp": {
    "servers": {
      "confluence": {
        "url": "http://localhost:3001/mcp",
        "transport": { "type": "sse" },
        "headers": { "x-mcp-api-key": "${MCP_API_KEY_A}" },
        "description": "Confluence MCP (Project A)"
      },
      "confluence-project-b": {
        "url": "http://localhost:3002/mcp",
        "transport": { "type": "sse" },
        "headers": { "x-mcp-api-key": "${MCP_API_KEY_B}" },
        "description": "Confluence MCP (Project B)"
      }
    }
  }
}
```

**Note**: Tools are automatically discovered from each server. No need to list them.

## Verification

### Test MCP Server Connection

```bash
# 1. Check server is running
curl http://localhost:3001/health

# 2. Verify MCP endpoint
curl http://localhost:3001/mcp

# 3. Get configuration
curl http://localhost:3001/mcp/vscode
```

### Verify in VS Code

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
3. Type "MCP" to see MCP-related commands
4. Run "MCP: List Available Servers"
5. You should see "confluence" in the list

### Test MCP Tools

In VS Code, you can now use MCP tools:
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "MCP: Execute Tool"
3. Select "confluence" server
4. Choose a tool (e.g., `confluence_test_connection`)

## Troubleshooting

### Server Not Appearing in VS Code

**Check settings.json syntax**:
```bash
# Validate JSON
cat .vscode/settings.json | python -m json.tool
```

**Restart VS Code**:
1. Close all VS Code windows
2. Reopen the project
3. Or use "Reload Window" command

### Connection Failed

**Verify server is running**:
```bash
docker ps | grep confluence-mcp
curl http://localhost:3001/health
```

**Check API key**:
```bash
# View configured key
echo $MCP_API_KEY

# Compare with .env
cat .env | grep MCP_API_KEY
```

**Test connection manually**:
```bash
curl -H "x-mcp-api-key: $MCP_API_KEY" http://localhost:3001/mcp
```

### Tools Not Working

**View MCP server logs**:
```bash
docker logs confluence-mcp
docker logs -f confluence-mcp  # Follow logs
```

**Test individual tool**:
```bash
# Test connection
curl -X POST http://localhost:3001/mcp \
  -H "x-mcp-api-key: $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "confluence_test_connection",
      "arguments": {}
    }
  }'
```

### Network Issues in Devcontainer

**Check dev-network**:
```bash
docker network inspect dev-network
```

**Test container connectivity**:
```bash
# From devcontainer terminal
ping confluence-mcp
curl http://confluence-mcp:3001/health
```

## Advanced: Programmatic Configuration

### Node.js/TypeScript

```typescript
import { writeFile } from 'fs/promises';

async function configureMCP(options: {
  isDevcontainer?: boolean;
  projectName?: string;
  port?: number;
}) {
  const params = new URLSearchParams();
  if (options.isDevcontainer) params.set('devcontainer', 'true');
  if (options.projectName) params.set('project', options.projectName);
  
  const url = `http://localhost:${options.port || 3001}/mcp/vscode?${params}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  
  const data = await response.json();
  
  // Save to .vscode/settings.json
  const settings = {
    mcp: {
      servers: data.config.mcpServers
    }
  };
  
  await writeFile('.vscode/settings.json', JSON.stringify(settings, null, 2));
  console.log('✅ MCP configuration saved to .vscode/settings.json');
}

// Usage
await configureMCP({ isDevcontainer: true, projectName: 'my-project' });
```

### Python

```python
import requests
import json
from pathlib import Path

def configure_mcp(is_devcontainer=False, project_name=None, port=3001):
    params = {}
    if is_devcontainer:
        params['devcontainer'] = 'true'
    if project_name:
        params['project'] = project_name
    
    url = f"http://localhost:{port}/mcp/vscode"
    response = requests.get(url, params=params, headers={'Accept': 'application/json'})
    data = response.json()
    
    # Create .vscode directory
    Path('.vscode').mkdir(exist_ok=True)
    
    # Save configuration
    settings = {
        'mcp': {
            'servers': data['config']['mcpServers']
        }
    }
    
    with open('.vscode/settings.json', 'w') as f:
        json.dump(settings, f, indent=2)
    
    print('✅ MCP configuration saved to .vscode/settings.json')

# Usage
configure_mcp(is_devcontainer=True, project_name='my-project')
```

## Best Practices

1. **Use environment variables** for API keys instead of hardcoding
2. **Fetch configuration dynamically** in dev container setup scripts
3. **Version control** the fetch script, not the settings.json
4. **Document for team** how to get API keys and configure MCP
5. **Test configuration** after fetching to ensure it works
6. **Update regularly** when MCP server capabilities change

## Summary

The `/mcp/vscode` endpoint provides:
- ✅ Automatic VS Code MCP server configuration generation
- ✅ Support for host and devcontainer environments
- ✅ Multi-project setup with unique container names
- ✅ Environment variable substitution for API keys
- ✅ Complete setup instructions in response
- ✅ Both JSON and Markdown output formats

Developers can now configure VS Code to use the Confluence MCP server with a single curl command!
