#!/bin/bash
# Test script for pandoc-mcp setup

set -e

echo "🧪 Testing Pandoc MCP Setup"
echo "============================="
echo ""

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

echo "✅ Docker is available"
echo ""

# Check if dev-network exists
if ! docker network inspect dev-network &> /dev/null; then
    echo "📡 Creating dev-network..."
    docker network create dev-network
    echo "✅ Network created"
else
    echo "✅ dev-network exists"
fi
echo ""

# Check .env file
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    # Generate MCP_API_KEY if not exists
    if ! grep -q "^MCP_API_KEY=" .env; then
        API_KEY=$(openssl rand -hex 32)
        echo "MCP_API_KEY=$API_KEY" >> .env
        echo "✅ Generated MCP_API_KEY"
    fi
else
    echo "✅ .env file exists"
fi
echo ""

# Test if we can access the pandoc-mcp directory
if [ -d "pandoc-mcp" ]; then
    echo "✅ pandoc-mcp directory found"
    
    # Check for required files
    for file in Dockerfile package.json tsconfig.json; do
        if [ -f "pandoc-mcp/$file" ]; then
            echo "  ✅ $file exists"
        else
            echo "  ❌ $file missing"
            exit 1
        fi
    done
else
    echo "❌ pandoc-mcp directory not found"
    exit 1
fi
echo ""

# Check source files
if [ -d "pandoc-mcp/src" ]; then
    echo "✅ Source directory exists"
    
    for file in index.ts server.ts; do
        if [ -f "pandoc-mcp/src/$file" ]; then
            echo "  ✅ $file exists"
        else
            echo "  ❌ $file missing"
            exit 1
        fi
    done
else
    echo "❌ pandoc-mcp/src directory not found"
    exit 1
fi
echo ""

echo "✅ All basic checks passed!"
echo ""
echo "📝 Next steps:"
echo "1. Build the image: docker compose build pandoc-mcp"
echo "2. Start the service: docker compose up -d pandoc-mcp"
echo "3. Test health: curl http://localhost:3002/health"
echo "4. Get agent definition: curl http://localhost:3002/agent"
echo "5. Get VS Code config: curl http://localhost:3002/mcp/vscode"
echo ""
echo "Note: Building may take several minutes due to LaTeX packages."
