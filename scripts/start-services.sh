#!/bin/bash

# Script to start Docker diagram services
# Can be added to .bashrc for automatic startup

cd "$(dirname "$0")/.."

echo "🚀 Starting Docker Diagram Services..."

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo "⚠️  Docker is not running. Starting Docker..."
    sudo systemctl start docker
    sleep 2
fi

# Check if network exists
if ! docker network inspect dev-network &> /dev/null; then
    echo "📡 Creating dev-network..."
    docker network create dev-network
fi

# Start services
if docker-compose ps | grep -q "Up"; then
    echo "ℹ️  Services are already running"
else
    echo "📦 Starting services..."
    docker-compose up -d
fi

# Wait a moment for services to initialize
sleep 3

# Check status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ Services started successfully!"
echo ""
echo "Access:"
echo "  • Diagram Converter: http://localhost:3000/health"
echo "  • Confluence MCP:    http://localhost:3001"
