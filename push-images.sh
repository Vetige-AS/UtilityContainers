#!/bin/bash
# Push Docker images to registry

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Docker Image Push Script                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Read Docker Hub username
read -p "Enter your Docker Hub username: " DOCKER_USERNAME

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}Error: Docker Hub username is required${NC}"
    exit 1
fi

# Update .env file with your username
echo -e "${BLUE}📝 Updating .env with your username...${NC}"
sed -i "s|yourusername|${DOCKER_USERNAME}|g" .env

# Source the updated .env
source .env

echo ""
echo -e "${BLUE}🔐 Logging into Docker Hub...${NC}"
docker login

echo ""
echo -e "${BLUE}🏷️  Tagging images...${NC}"

# Tag diagram-converter
docker tag docker-diagram-services-diagram-converter:latest ${DIAGRAM_CONVERTER_IMAGE}
echo -e "${GREEN}✅ Tagged: ${DIAGRAM_CONVERTER_IMAGE}${NC}"

# Tag confluence-mcp
docker tag docker-diagram-services-confluence-mcp:latest ${CONFLUENCE_MCP_IMAGE}
echo -e "${GREEN}✅ Tagged: ${CONFLUENCE_MCP_IMAGE}${NC}"

echo ""
echo -e "${BLUE}⬆️  Pushing images to Docker Hub...${NC}"

# Push diagram-converter
echo -e "${BLUE}Pushing diagram-converter...${NC}"
docker push ${DIAGRAM_CONVERTER_IMAGE}
echo -e "${GREEN}✅ Pushed: ${DIAGRAM_CONVERTER_IMAGE}${NC}"

echo ""
# Push confluence-mcp
echo -e "${BLUE}Pushing confluence-mcp...${NC}"
docker push ${CONFLUENCE_MCP_IMAGE}
echo -e "${GREEN}✅ Pushed: ${CONFLUENCE_MCP_IMAGE}${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ All images pushed successfully!        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo "Your images are now available at:"
echo "  - ${DIAGRAM_CONVERTER_IMAGE}"
echo "  - ${CONFLUENCE_MCP_IMAGE}"
echo ""
echo "To pull them on another machine:"
echo "  docker pull ${DIAGRAM_CONVERTER_IMAGE}"
echo "  docker pull ${CONFLUENCE_MCP_IMAGE}"
echo ""
