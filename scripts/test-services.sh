#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Testing Docker Diagram Services                          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if services are running
echo "📊 Checking Service Status..."
if ! docker ps | grep -q diagram-converter; then
    echo "❌ diagram-converter is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

if ! docker ps | grep -q confluence-mcp; then
    echo "⚠️  confluence-mcp is not running"
    echo "   This is optional for diagram conversion"
fi

echo "✅ Services are running"
echo ""

# Test Diagram Converter
echo "🧪 Testing Diagram Converter Service..."
echo "─────────────────────────────────────────"

if command -v jq &> /dev/null; then
    response=$(curl -s http://localhost:3000/health)
    if echo "$response" | jq -e '.status == "ok"' > /dev/null 2>&1; then
        echo "✅ Health check: OK"
        echo "$response" | jq .
    else
        echo "❌ Health check: FAILED"
        echo "$response"
    fi
else
    response=$(curl -s http://localhost:3000/health)
    if echo "$response" | grep -q '"status":"ok"'; then
        echo "✅ Health check: OK"
        echo "$response"
    else
        echo "❌ Health check: FAILED"
        echo "$response"
    fi
fi
echo ""

# Test Confluence MCP (optional)
echo "🧪 Testing Confluence MCP Service..."
echo "─────────────────────────────────────────"

response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null)
if [ "$response" == "200" ]; then
    echo "✅ Confluence MCP: Responding"
    curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
elif [ "$response" == "404" ]; then
    echo "⚠️  Confluence MCP: Running (health endpoint not available)"
else
    echo "⚠️  Confluence MCP: May not be responding"
fi
echo ""

# Show container status
echo "📦 Container Status:"
echo "─────────────────────────────────────────"
docker ps --filter "name=diagram-converter" --filter "name=confluence-mcp" \
    --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Show network info
echo "🌐 Network Information:"
echo "─────────────────────────────────────────"
if docker network inspect dev-network >/dev/null 2>&1; then
    echo "Network: dev-network"
    docker network inspect dev-network --format '{{range .Containers}}  • {{.Name}}: {{.IPv4Address}}{{"\n"}}{{end}}'
else
    echo "❌ Network 'dev-network' not found"
fi
echo ""

# Resource usage
echo "💻 Resource Usage:"
echo "─────────────────────────────────────────"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
    diagram-converter confluence-mcp 2>/dev/null || echo "⚠️  Could not retrieve stats"
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Test Complete                                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
