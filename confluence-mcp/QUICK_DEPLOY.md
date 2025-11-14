# 🚀 Quick Deployment Guide

## Step 1: Generate Your Secure API Key

Run this command to generate a secure API key:

```bash
node scripts/generate-api-key.js
```

**Example output:**
```
🔐 Generating secure MCP API key...

✅ Generated secure API key:
MCP_API_KEY=Kx9mP2vQ8rT5wE7yU1iO3pA6sD9fG2hJ4kL7nM0qR8tY5uI3oP6aS9dF2gH4jK7l

📋 Copy this key and use it in your deployment:

For Fly.io deployment:
fly secrets set MCP_API_KEY="Kx9mP2vQ8rT5wE7yU1iO3pA6sD9fG2hJ4kL7nM0qR8tY5uI3oP6aS9dF2gH4jK7l"

For local development (.env file):
MCP_API_KEY=Kx9mP2vQ8rT5wE7yU1iO3pA6sD9fG2hJ4kL7nM0qR8tY5uI3oP6aS9dF2gH4jK7l

⚠️  IMPORTANT: Store this key securely and never commit it to version control!
   This key provides access to your Confluence MCP server.
```

**Save this API key securely - you'll need it for authentication!**

## Step 2: Deploy to Fly.io

### Option A: Automated Deployment (Recommended)

```bash
./scripts/deploy-to-fly.sh
```

This script will:
- ✅ Check Fly CLI installation
- 🔐 Generate API key (if needed)
- 📝 Prompt for Confluence credentials
- 🏗️ Create Fly.io app
- 💾 Set up persistent storage
- 🔒 Configure secrets
- 🚀 Deploy your server
- 🧪 Test the deployment

### Option B: Manual Deployment

1. **Login to Fly.io:**
   ```bash
   fly auth login
   ```

2. **Create your app:**
   ```bash
   fly apps create confluence-mcp-yourusername
   ```

3. **Create persistent volume:**
   ```bash
   fly volumes create confluence_mcp_data --region iad --size 1 -a confluence-mcp-yourusername
   ```

4. **Set your secrets:**
   ```bash
   fly secrets set \
     CONFLUENCE_BASE_URL="https://your-domain.atlassian.net" \
     CONFLUENCE_USERNAME="your-email@domain.com" \
     CONFLUENCE_API_TOKEN="your-confluence-api-token" \
     MCP_API_KEY="your-generated-api-key" \
     PORT="3000" \
     -a confluence-mcp-yourusername
   ```

5. **Deploy:**
   ```bash
   fly deploy -a confluence-mcp-yourusername
   ```

## Step 3: Test Your Deployment

```bash
# Test health endpoint
curl https://confluence-mcp-yourusername.fly.dev/health

# Test with your API key
curl -H "X-MCP-API-Key: your-api-key" https://confluence-mcp-yourusername.fly.dev/mcp
```

Or use the test script:
```bash
node scripts/test-deployment.js https://confluence-mcp-yourusername.fly.dev your-api-key
```

## Step 4: Configure Your AI Assistant

Add this to your AI assistant's MCP configuration:

```json
{
  "mcpServers": {
    "confluence": {
      "transport": "sse",
      "url": "https://confluence-mcp-yourusername.fly.dev/mcp",
      "headers": {
        "X-MCP-API-Key": "your-api-key"
      }
    }
  }
}
```

## 🔒 Security Features

Your deployed server includes:

- **API Key Authentication**: Unique key for server access
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security Headers**: XSS protection, content validation
- **Secure Sessions**: Cryptographically secure session IDs
- **HTTPS Only**: Automatic SSL/TLS encryption

## 🎉 You're Ready!

Your Confluence MCP server is now running securely on Fly.io and ready to use with your AI assistant!

## Need Help?

- Check logs: `fly logs -a your-app-name`
- View app status: `fly status -a your-app-name`
- Scale resources: `fly scale memory 2048 -a your-app-name`
