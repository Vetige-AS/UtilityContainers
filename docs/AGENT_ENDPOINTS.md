# Agent Definition Endpoints

Both services expose `/agent` endpoints that return VS Code agent definition files. This allows developers to dynamically fetch and configure VS Code agents from running services.

## Available Endpoints

### Diagram Converter Agent
- **URL**: `http://localhost:3000/agent` (from host)
- **URL**: `http://diagram-converter:3000/agent` (from devcontainer)
- **Returns**: Markdown-formatted VS Code agent definition for diagram conversion

### Confluence MCP Agent
- **URL**: `http://localhost:3001/agent` (from host)
- **URL**: `http://confluence-mcp:3001/agent` (from devcontainer)
- **Returns**: Markdown-formatted VS Code agent definition for Confluence publishing

## Usage

### Fetch Agent Definition

```bash
# From your host machine
curl http://localhost:3000/agent > .vscode/diagram-agent.agent.md
curl http://localhost:3001/agent > .vscode/confluence-agent.agent.md

# From within a devcontainer on dev-network
curl http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md
```

### Programmatic Usage

**JavaScript/TypeScript:**
```typescript
async function fetchAgentDefinition(serviceUrl: string): Promise<string> {
  const response = await fetch(`${serviceUrl}/agent`);
  return await response.text();
}

// Usage
const diagramAgent = await fetchAgentDefinition('http://diagram-converter:3000');
const confluenceAgent = await fetchAgentDefinition('http://confluence-mcp:3001');

// Save to .vscode directory
await fs.writeFile('.vscode/diagram-agent.agent.md', diagramAgent);
await fs.writeFile('.vscode/confluence-agent.agent.md', confluenceAgent);
```

**Python:**
```python
import requests

def fetch_agent_definition(service_url: str) -> str:
    response = requests.get(f"{service_url}/agent")
    return response.text

# Usage
diagram_agent = fetch_agent_definition('http://diagram-converter:3000')
confluence_agent = fetch_agent_definition('http://confluence-mcp:3001')

# Save to .vscode directory
with open('.vscode/diagram-agent.agent.md', 'w') as f:
    f.write(diagram_agent)
with open('.vscode/confluence-agent.agent.md', 'w') as f:
    f.write(confluence_agent)
```

**Shell Script:**
```bash
#!/bin/bash
# setup-agents.sh - Fetch and configure VS Code agents

VSCODE_DIR=".vscode"
mkdir -p "$VSCODE_DIR"

echo "Fetching agent definitions from services..."

# Fetch diagram converter agent
if curl -f http://localhost:3000/agent > "$VSCODE_DIR/diagram-agent.agent.md" 2>/dev/null; then
    echo "✅ Diagram converter agent configured"
else
    echo "❌ Failed to fetch diagram converter agent (is service running?)"
fi

# Fetch confluence MCP agent
if curl -f http://localhost:3001/agent > "$VSCODE_DIR/confluence-agent.agent.md" 2>/dev/null; then
    echo "✅ Confluence MCP agent configured"
else
    echo "❌ Failed to fetch confluence MCP agent (is service running?)"
fi

echo "Done! Restart VS Code to load the agents."
```

## Multi-Project Setup

For projects using these services with unique container names:

```bash
#!/bin/bash
# Project-specific agent fetcher

PROJECT_NAME=${PROJECT_NAME:-"myproject"}
DIAGRAM_URL="http://${PROJECT_NAME}-diagram-converter:3000"
CONFLUENCE_URL="http://${PROJECT_NAME}-confluence-mcp:3001"

mkdir -p .vscode

# Fetch from project-specific containers
curl "$DIAGRAM_URL/agent" > .vscode/diagram-agent.agent.md
curl "$CONFLUENCE_URL/agent" > .vscode/confluence-agent.agent.md
```

## Benefits

### Dynamic Configuration
- Agent definitions stay up-to-date with service capabilities
- No manual copying of .agent.md files
- Easy to sync across team members

### Version Control
- Include fetch script in repository
- Team members run script to get latest agent definitions
- Optionally `.gitignore` the .agent.md files if they're generated

### CI/CD Integration
```yaml
# .github/workflows/setup.yml
- name: Setup VS Code Agents
  run: |
    docker compose up -d
    sleep 5  # Wait for services to start
    curl http://localhost:3000/agent > .vscode/diagram-agent.agent.md
    curl http://localhost:3001/agent > .vscode/confluence-agent.agent.md
```

### Dev Container Integration
```json
// .devcontainer/devcontainer.json
{
  "name": "My Project",
  "postCreateCommand": "bash .devcontainer/setup-agents.sh",
  "customizations": {
    "vscode": {
      "settings": {
        "files.associations": {
          "*.agent.md": "markdown"
        }
      }
    }
  }
}
```

**setup-agents.sh:**
```bash
#!/bin/bash
mkdir -p .vscode
curl http://diagram-converter:3000/agent > .vscode/diagram-agent.agent.md
curl http://confluence-mcp:3001/agent > .vscode/confluence-agent.agent.md
```

## Verification

Check that agents are properly configured:

```bash
# List agent files
ls -la .vscode/*.agent.md

# Check agent frontmatter
head -10 .vscode/diagram-agent.agent.md
head -10 .vscode/confluence-agent.agent.md

# Verify VS Code recognizes them
# Open VS Code and type: @diagram-converter or @confluence-publisher
```

## Response Format

The `/agent` endpoint returns:
- **Content-Type**: `text/markdown`
- **Format**: Valid VS Code .agent.md file with YAML frontmatter
- **Structure**:
  ```markdown
  ---
  description: Agent description
  name: agent-name
  argument-hint: Usage hint
  tools: ['edit', 'search', 'usages']
  target: vscode
  ---
  
  # Agent Instructions
  
  [Full agent definition content...]
  ```

## Troubleshooting

### Service Not Responding
```bash
# Check if services are running
docker compose ps

# Start services if needed
docker compose up -d

# Check health
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### Network Issues from Devcontainer
```bash
# Verify dev-network connection
docker network inspect dev-network

# Check container names
docker ps --format "table {{.Names}}\t{{.Networks}}"

# Test connectivity
ping diagram-converter
ping confluence-mcp
```

### Invalid Agent File
```bash
# Validate YAML frontmatter
head -n 10 .vscode/diagram-agent.agent.md

# Should see:
# ---
# description: ...
# name: ...
# ---
```

## Best Practices

1. **Automate fetching** - Add to setup scripts or dev container post-create commands
2. **Version control fetch script** - Not necessarily the .agent.md files themselves
3. **Validate before use** - Check file exists and has valid frontmatter
4. **Keep agents updated** - Re-fetch when services are updated
5. **Document for team** - Explain how to refresh agent definitions

## Example: Complete Setup Script

```bash
#!/bin/bash
# complete-setup.sh - Full project setup including agents

set -e

echo "🚀 Setting up project..."

# 1. Create Docker network
echo "📡 Creating Docker network..."
docker network create dev-network 2>/dev/null || echo "Network already exists"

# 2. Start services
echo "🐳 Starting services..."
docker compose up -d

# 3. Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
timeout 30 bash -c 'until curl -f http://localhost:3000/health &>/dev/null; do sleep 1; done'
timeout 30 bash -c 'until curl -f http://localhost:3001/health &>/dev/null; do sleep 1; done'

# 4. Fetch agent definitions
echo "🤖 Configuring VS Code agents..."
mkdir -p .vscode
curl -f http://localhost:3000/agent > .vscode/diagram-agent.agent.md
curl -f http://localhost:3001/agent > .vscode/confluence-agent.agent.md

echo "✅ Setup complete!"
echo ""
echo "Available agents:"
echo "  - @diagram-converter"
echo "  - @confluence-publisher"
echo ""
echo "Restart VS Code to load the agents."
```

## Integration with Existing Agents

Agents can reference each other using the `@agent-name` syntax:

```markdown
## Integration with Diagram Agent

You can delegate diagram conversion to the @diagram-converter agent:
- Use @diagram-converter when asked to publish content with diagrams
- Or call diagram-converter service directly before publishing
```

This creates a powerful workflow where agents collaborate to complete complex tasks.
