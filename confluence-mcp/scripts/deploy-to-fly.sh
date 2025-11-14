#!/bin/bash

# Confluence MCP Server - Fly.io Deployment Script
# This script helps deploy the Confluence MCP server to Fly.io with proper security

set -e

echo "🚀 Confluence MCP Server - Fly.io Deployment"
echo "============================================="

# Check if flyctl is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Please install it first:"
    echo "   brew install flyctl"
    echo "   or visit: https://fly.io/docs/getting-started/installing-flyctl/"
    exit 1
fi

# Check if user is logged in
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Please log in to Fly.io first:"
    echo "   fly auth login"
    exit 1
fi

echo "✅ Fly CLI is installed and you're logged in"

# Generate API key if not provided
if [ -z "$MCP_API_KEY" ]; then
    echo ""
    echo "🔐 Generating secure MCP API key..."
    MCP_API_KEY=$(node scripts/generate-api-key.js | grep "MCP_API_KEY=" | cut -d'=' -f2)
    echo "Generated API key: $MCP_API_KEY"
fi

# Prompt for Confluence credentials
echo ""
echo "📝 Please provide your Confluence credentials:"

read -p "Confluence URL (e.g., https://mycompany.atlassian.net): " CONFLUENCE_URL
read -p "Confluence Username/Email: " CONFLUENCE_USERNAME
read -s -p "Confluence API Token: " CONFLUENCE_API_TOKEN
echo ""

# Validate inputs
if [ -z "$CONFLUENCE_URL" ] || [ -z "$CONFLUENCE_USERNAME" ] || [ -z "$CONFLUENCE_API_TOKEN" ]; then
    echo "❌ All Confluence credentials are required"
    exit 1
fi

# Check if app exists, if not create it
APP_NAME="confluence-mcp-$(whoami)"
echo ""
echo "🏗️  Setting up Fly.io app: $APP_NAME"

if ! fly apps list | grep -q "$APP_NAME"; then
    echo "Creating new Fly.io app..."
    fly apps create "$APP_NAME" --org personal
    
    # Update fly.toml with the app name
    sed -i.bak "s/app = \"confluence-mcp\"/app = \"$APP_NAME\"/" fly.toml
    echo "Updated fly.toml with app name: $APP_NAME"
fi

# Create volume if it doesn't exist
echo ""
echo "💾 Setting up persistent volume..."
if ! fly volumes list -a "$APP_NAME" | grep -q "confluence_mcp_data"; then
    fly volumes create confluence_mcp_data --region iad --size 1 -a "$APP_NAME"
    echo "✅ Created persistent volume"
else
    echo "✅ Volume already exists"
fi

# Set secrets
echo ""
echo "🔒 Setting up secrets..."
fly secrets set \
    CONFLUENCE_BASE_URL="$CONFLUENCE_URL" \
    CONFLUENCE_USERNAME="$CONFLUENCE_USERNAME" \
    CONFLUENCE_API_TOKEN="$CONFLUENCE_API_TOKEN" \
    MCP_API_KEY="$MCP_API_KEY" \
    PORT="3000" \
    -a "$APP_NAME"

echo "✅ Secrets configured"

# Deploy
echo ""
echo "🚀 Deploying to Fly.io..."
fly deploy -a "$APP_NAME"

# Get the app URL
APP_URL="https://$APP_NAME.fly.dev"

echo ""
echo "🎉 Deployment complete!"
echo "======================================"
echo "App URL: $APP_URL"
echo "Health Check: $APP_URL/health"
echo ""
echo "🔑 Your MCP API Key: $MCP_API_KEY"
echo ""
echo "⚠️  IMPORTANT: Save your API key securely!"
echo "   You'll need it to connect to your MCP server."
echo ""
echo "📖 Next steps:"
echo "1. Test your deployment: curl $APP_URL/health"
echo "2. Configure your AI assistant to use: $APP_URL"
echo "3. Use the API key for authentication"

# Test deployment
echo ""
echo "🧪 Testing deployment..."
if curl -s "$APP_URL/health" | grep -q "ok"; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed. Check logs with: fly logs -a $APP_NAME"
fi
