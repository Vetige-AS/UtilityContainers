# Confluence MCP Deployment Guide

This guide covers deploying the Confluence MCP server to Fly.io for production use with enhanced security.

## 🔒 Security Features

- **API Key Authentication**: Unique MCP API key for server access
- **Rate Limiting**: 100 requests per 15-minute window per IP
- **Security Headers**: XSS protection, content type validation, frame denial
- **Secure Session IDs**: Cryptographically secure session management
- **Request Validation**: Input sanitization and size limits

## Prerequisites

- [Fly.io account](https://fly.io/app/sign-up)
- [Fly CLI installed](https://fly.io/docs/getting-started/installing-flyctl/)
- Confluence Cloud instance with API access
- Confluence API token

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd confluence-mcp
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Confluence credentials:

```env
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
MCP_API_KEY=your-secure-mcp-key
PORT=3001
```

### 3. Get Confluence API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "MCP Server")
4. Copy the token immediately (you won't see it again)

### 4. Test Locally

```bash
npm run dev
```

Test the server:

```bash
node simple-test.js
```

## 🚀 Quick Deployment (Recommended)

### Automated Deployment Script

The easiest way to deploy is using our automated script:

```bash
# Generate a secure API key and deploy in one step
npm run deploy
```

This script will:
1. ✅ Check Fly CLI installation and login status
2. 🔐 Generate a secure MCP API key
3. 📝 Prompt for your Confluence credentials
4. 🏗️ Create or update your Fly.io app
5. 💾 Set up persistent storage volume
6. 🔒 Configure all secrets securely
7. 🚀 Deploy your server
8. 🧪 Test the deployment

### Manual Deployment Steps

If you prefer manual control:

#### 1. Generate Secure API Key

```bash
npm run generate-key
```

Save the generated key securely - you'll need it for authentication.

#### 2. Login to Fly.io

```bash
fly auth login
```

#### 3. Create and Configure App

```bash
# Create app (replace 'your-app-name' with your preferred name)
fly apps create your-app-name

# Create persistent volume
fly volumes create confluence_mcp_data --region iad --size 1 -a your-app-name
```

#### 4. Set Production Secrets

```bash
# Set Confluence credentials
fly secrets set CONFLUENCE_BASE_URL=https://your-domain.atlassian.net -a your-app-name
fly secrets set CONFLUENCE_USERNAME=your-email@domain.com -a your-app-name
fly secrets set CONFLUENCE_API_TOKEN=your-api-token -a your-app-name

# Set MCP API key for security (use the key from step 1)
fly secrets set MCP_API_KEY=your-generated-secure-key -a your-app-name

# Set port
fly secrets set PORT=3000 -a your-app-name
```

#### 5. Deploy

```bash
npm run build
fly deploy -a your-app-name
```

#### 6. Verify Deployment

```bash
# Check app status
fly status -a your-app-name

# View logs
fly logs -a your-app-name

# Test health endpoint
curl https://your-app-name.fly.dev/health
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONFLUENCE_BASE_URL` | Yes | Your Confluence instance URL |
| `CONFLUENCE_USERNAME` | Yes | Your Confluence username/email |
| `CONFLUENCE_API_TOKEN` | Yes | Your Confluence API token |
| `MCP_API_KEY` | Recommended | API key for MCP access |
| `PORT` | No | Server port (default: 3000) |
| `CACHE_FILE_PATH` | No | Cache file location (default: ./markdown-page-mapping.json) |

### Fly.io Configuration

The `fly.toml` file includes:

- **Memory**: 1GB RAM for Puppeteer/Chrome
- **CPU**: 1 shared CPU
- **Health checks**: Automatic health monitoring
- **Auto-scaling**: Scales to 0 when not in use
- **Volume**: Persistent storage for cache

### Security Considerations

1. **API Keys**: Always use `fly secrets set` for sensitive data
2. **HTTPS**: Fly.io provides automatic HTTPS
3. **Access Control**: Consider implementing IP restrictions if needed
4. **Token Rotation**: Regularly rotate your Confluence API tokens

## 🔗 Using Your Deployed Server

### Server Endpoints

Your deployed server will be available at: `https://your-app-name.fly.dev`

**Available endpoints:**
- `GET /health` - Health check (no auth required)
- `GET /mcp` - SSE connection for MCP protocol (requires API key)
- `POST /messages` - MCP message handling (requires API key)

### Authentication

All MCP endpoints require authentication using your generated API key:

**Header Authentication:**
```bash
curl -H "X-MCP-API-Key: your-api-key" https://your-app-name.fly.dev/mcp
```

**Query Parameter Authentication:**
```bash
curl "https://your-app-name.fly.dev/mcp?apiKey=your-api-key"
```

### AI Assistant Configuration

#### For SSE-based MCP Clients

Configure your AI assistant to connect to your deployed server:

```json
{
  "mcpServers": {
    "confluence": {
      "transport": "sse",
      "url": "https://your-app-name.fly.dev/mcp",
      "headers": {
        "X-MCP-API-Key": "your-api-key"
      }
    }
  }
}
```

#### For Local Development/Testing

You can still use the local version for development:

```json
{
  "mcpServers": {
    "confluence-local": {
      "command": "node",
      "args": ["/path/to/confluence-mcp/dist/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://your-domain.atlassian.net",
        "CONFLUENCE_USERNAME": "your-email@domain.com",
        "CONFLUENCE_API_TOKEN": "your-api-token",
        "MCP_API_KEY": "your-api-key"
      }
    }
  }
}
```

### SSE Client Configuration

For SSE-based clients, connect to:

```
GET https://your-app-name.fly.dev/mcp
POST https://your-app-name.fly.dev/messages?sessionId=<session-id>
```

## Monitoring and Maintenance

### View Logs

```bash
# Real-time logs
fly logs

# Historical logs
fly logs --app your-app-name
```

### Scale Resources

```bash
# Scale memory
fly scale memory 2048

# Scale CPU
fly scale count 2
```

### Update Deployment

```bash
# Deploy latest changes
fly deploy

# Deploy specific version
fly deploy --image your-app-name:v1.2.3
```

### Backup Cache Data

```bash
# SSH into the app
fly ssh console

# Copy cache file
fly sftp get /data/markdown-page-mapping.json ./backup/
```

## Troubleshooting

### Common Issues

1. **Puppeteer/Chrome Issues**
   - Ensure sufficient memory (1GB+)
   - Check Chrome flags in `fly.toml`

2. **Confluence API Errors**
   - Verify API token is valid
   - Check base URL format
   - Ensure user has proper permissions

3. **Memory Issues**
   - Monitor with `fly logs`
   - Scale memory if needed
   - Optimize Mermaid rendering

### Debug Commands

```bash
# Check app status
fly status

# View resource usage
fly metrics

# SSH into app
fly ssh console

# Check environment variables
fly ssh console -C "env | grep CONFLUENCE"
```

## Performance Optimization

### Mermaid Rendering

- Diagrams are cached after first render
- Consider pre-rendering common diagrams
- Monitor memory usage during rendering

### Confluence API

- Implement rate limiting if needed
- Cache space/page listings
- Use batch operations when possible

### Fly.io Optimization

- Use regions close to your Confluence instance
- Enable auto-scaling for cost efficiency
- Monitor and adjust resource allocation

## Support

For issues:

1. Check the logs: `fly logs`
2. Verify configuration: Environment variables and secrets
3. Test locally first: `npm run dev`
4. Check Confluence API access independently

## Next Steps

After deployment:

1. Test all MCP tools with your AI assistant
2. Create sample pages to verify formatting
3. Set up monitoring and alerts
4. Document your team's usage patterns
5. Consider implementing additional security measures
