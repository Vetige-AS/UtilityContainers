# Confluence MCP Server Configuration Guide

## Two Configuration Modes

The Confluence MCP server supports **two modes** of operation:

### Mode 1: Generic Mode (Current - Recommended for Multi-Project)

**No Confluence credentials in `.env`** - The server runs in "generic mode" where credentials are provided per-request through the MCP tools.

**Current `.env` configuration:**
```env
# MCP Server Authentication (Required)
MCP_API_KEY=90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5

# Service Ports
CONFLUENCE_MCP_PORT=3001

# Optional - Leave blank for generic mode
# CONFLUENCE_BASE_URL=
# CONFLUENCE_USERNAME=
# CONFLUENCE_API_TOKEN=
```

**How it works:**
1. Server starts without Confluence credentials
2. Each project/client provides credentials via `confluence_setup_project` tool
3. Configuration stored in project-specific file (`.confluence-config.json`)
4. Great for working with multiple Confluence instances

**First-time setup per project:**
```javascript
// Call this tool once per project to configure Confluence connection
confluence_setup_project({
  confluenceUrl: "https://your-company.atlassian.net",
  username: "your-email@company.com",
  apiToken: "ATATT3xFfGF0...", // Get from https://id.atlassian.com/manage-profile/security/api-tokens
  spaceKey: "MYSPACE",           // The Confluence space key (e.g., "TEAM", "DOC")
  parentPageTitle: "Documentation", // Optional: Parent page for new pages
  baseDir: "/workspace/docs"     // Optional: Base directory for markdown files
})
```

### Mode 2: Pre-configured Mode (Single Confluence Instance)

**Confluence credentials in `.env`** - The server connects to a specific Confluence instance on startup.

**`.env` configuration:**
```env
# MCP Server Authentication (Required)
MCP_API_KEY=90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5

# Confluence Credentials (Pre-configured mode)
CONFLUENCE_BASE_URL=https://your-company.atlassian.net
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=ATATT3xFfGF0RZ5_IwIwMz...

# Service Ports
CONFLUENCE_MCP_PORT=3001
```

**How it works:**
1. Server starts with Confluence credentials
2. All MCP clients use the same Confluence instance
3. Still allows per-project configuration via `confluence_setup_project`
4. Good for single Confluence instance scenarios

## Required Environment Variables

### Always Required

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `MCP_API_KEY` | Authentication key for MCP server | `90214cca...` | Generated during setup |

### Optional (for Pre-configured Mode)

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `CONFLUENCE_BASE_URL` | Your Confluence instance URL | `https://mycompany.atlassian.net` | Your Confluence URL |
| `CONFLUENCE_USERNAME` | Your email address | `john@company.com` | Your Atlassian account email |
| `CONFLUENCE_API_TOKEN` | API token for authentication | `ATATT3xFfGF0...` | [Create at Atlassian](https://id.atlassian.com/manage-profile/security/api-tokens) |

## Getting Your Confluence Credentials

### Step 1: Get Your Confluence URL
- Cloud: `https://your-domain.atlassian.net`
- Server/Data Center: `https://confluence.your-company.com`

### Step 2: Get Your Username
- Use your Atlassian account email address
- Example: `john.doe@company.com`

### Step 3: Create an API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a descriptive label: `Confluence MCP Server`
4. Click **"Create"**
5. **Copy the token immediately** (you won't see it again!)
6. Store it securely (password manager, env file, etc.)

**API Token Format:**
```
ATATT3xFfGF0RZ5_IwIwMz2EqAaH9LkqXUdGSOwsAAURRWh3UhZh99yJ9xrt_2hWFIAUmiucw1EboQMAl7pE2P0bTcsFjzq5KrQHoK7Bsy4ZzIwqLYcV1mcBZPDCJ1CpOSP6-j_9wSvoP9tUjbqjS9bboWOZXyyorborv5CcQxk3rtccchPNgFU=A1B2C3D4
```

### Step 4: Find Your Space Key

1. Go to your Confluence space
2. Look at the URL: `https://your-domain.atlassian.net/wiki/spaces/MYSPACE/...`
3. The space key is the part after `/spaces/` (e.g., `MYSPACE`)

For personal spaces, the key looks like: `~123456789abcdef...`

## MCP Tool: confluence_setup_project

This tool configures Confluence connection settings for your project.

### Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `confluenceUrl` | ✅ Yes | Your Confluence instance URL (with or without trailing slash) | `https://mycompany.atlassian.net` |
| `username` | ✅ Yes | Your Atlassian account email | `john@company.com` |
| `apiToken` | ✅ Yes | Your Confluence API token | `ATATT3xFfGF0...` |
| `spaceKey` | ✅ Yes | The Confluence space key where pages will be created | `TEAM` or `~123456...` |
| `parentPageTitle` | ❌ No | Title of parent page for organizing new pages | `Documentation Hub` |
| `baseDir` | ❌ No | Base directory for markdown files (for cache mapping) | `/workspace/docs` |

### Example Usage

**Minimal configuration:**
```javascript
confluence_setup_project({
  confluenceUrl: "https://mycompany.atlassian.net",
  username: "john@company.com",
  apiToken: "ATATT3xFfGF0RZ5_...",
  spaceKey: "TEAM"
})
```

**Full configuration:**
```javascript
confluence_setup_project({
  confluenceUrl: "https://mycompany.atlassian.net",
  username: "john@company.com",
  apiToken: "ATATT3xFfGF0RZ5_...",
  spaceKey: "TEAM",
  parentPageTitle: "Documentation Hub",
  baseDir: "/workspace/docs"
})
```

### What Happens After Setup

1. Configuration saved to `.confluence-config.json` in your project
2. All subsequent Confluence operations use these settings
3. You can view settings anytime with `confluence_show_config`
4. Test connection with `confluence_test_connection`

## Testing Your Configuration

### Option 1: Use the test script

```bash
# Update test-your-config.js with your credentials
cd confluence-mcp
node test-your-config.js
```

### Option 2: Use MCP tools directly

```javascript
// 1. Setup configuration
confluence_setup_project({
  confluenceUrl: "https://mycompany.atlassian.net",
  username: "your-email@company.com",
  apiToken: "your-token",
  spaceKey: "YOUR_SPACE"
})

// 2. Test connection
confluence_test_connection()

// 3. List spaces (verify access)
confluence_list_spaces()

// 4. Create a test page
confluence_create_page({
  title: "Test Page from MCP",
  markdownContent: "# Hello\n\nThis is a test page created via MCP!"
})
```

## Recommended Setup for Different Scenarios

### Scenario 1: Single Developer, Single Confluence Instance
**Use:** Pre-configured mode (credentials in `.env`)
- Set `CONFLUENCE_BASE_URL`, `CONFLUENCE_USERNAME`, `CONFLUENCE_API_TOKEN` in `.env`
- Restart container: `docker-compose restart confluence-mcp`
- Ready to use immediately

### Scenario 2: Multiple Projects, Same Confluence Instance
**Use:** Generic mode with `confluence_setup_project` per project
- Leave Confluence credentials blank in `.env`
- Call `confluence_setup_project` once per project workspace
- Each project has its own `.confluence-config.json`

### Scenario 3: Multiple Confluence Instances (Different Clients)
**Use:** Generic mode
- Leave Confluence credentials blank in `.env`
- Call `confluence_setup_project` with different credentials per client
- Switch between configurations as needed

### Scenario 4: Team Environment with Shared Container
**Use:** Generic mode (most secure)
- No shared credentials in `.env`
- Each developer provides their own credentials via `confluence_setup_project`
- API tokens are personal and auditable

## Security Best Practices

1. **Never commit API tokens to git**
   - Add `.env` and `.confluence-config.json` to `.gitignore`
   - Use environment variables or secrets management

2. **Use personal API tokens**
   - Each team member should use their own token
   - Easier to track who made changes
   - Can revoke individual access without affecting others

3. **Rotate tokens regularly**
   - Confluence API tokens don't expire automatically
   - Recommend rotating every 90 days
   - Revoke old tokens after creating new ones

4. **Limit token permissions**
   - Confluence Cloud: Tokens inherit user permissions
   - Use a dedicated service account if needed
   - Grant minimum required space permissions

## Troubleshooting

### "Authentication failed" Error
- Verify your email and API token are correct
- Ensure API token is not expired or revoked
- Check you have access to the Confluence instance

### "Space not found" Error
- Verify the space key is correct (case-sensitive)
- Ensure you have permission to view the space
- Try listing spaces first: `confluence_list_spaces()`

### "Generic mode" vs "Configured mode"
- Check container logs: `docker logs confluence-mcp`
- Generic mode: "credentials can be provided per-request"
- Configured mode: Shows actual Confluence URL

### Configuration not persisting
- Ensure `baseDir` is set correctly
- Check file permissions on `.confluence-config.json`
- Verify workspace volume is mounted in docker-compose.yml

## Next Steps

After configuration:
1. ✅ Call `confluence_test_connection()` to verify setup
2. ✅ Use `confluence_list_spaces()` to see available spaces
3. ✅ Create your first page with `confluence_create_page()`
4. ✅ Integrate with GitHub Copilot or other MCP clients

For integration examples, see the main README.md.
