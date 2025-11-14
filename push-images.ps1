# Push Docker Images to Registry
# This script tags and pushes the built images to Docker Hub

# Colors for output
$Green = "`e[32m"
$Blue = "`e[34m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

Write-Host "${Blue}╔════════════════════════════════════════════╗${Reset}"
Write-Host "${Blue}║  Docker Image Push Script                 ║${Reset}"
Write-Host "${Blue}╚════════════════════════════════════════════╝${Reset}"
Write-Host ""

# Read Docker Hub username
$DOCKER_USERNAME = Read-Host "Enter your Docker Hub username"

if ([string]::IsNullOrWhiteSpace($DOCKER_USERNAME)) {
    Write-Host "${Yellow}Error: Docker Hub username is required${Reset}"
    exit 1
}

# Update .env file with your username
Write-Host "${Blue}📝 Updating .env with your username...${Reset}"
$envContent = Get-Content .env -Raw
$envContent = $envContent -replace 'yourusername', $DOCKER_USERNAME
Set-Content .env $envContent

# Read the updated .env
$envVars = Get-Content .env | Where-Object { $_ -match '^[^#]' -and $_ -match '=' }
foreach ($line in $envVars) {
    if ($line -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Variable -Name $name -Value $value
    }
}

Write-Host ""
Write-Host "${Blue}🔐 Logging into Docker Hub...${Reset}"
docker login

if ($LASTEXITCODE -ne 0) {
    Write-Host "${Yellow}Login failed. Please try again.${Reset}"
    exit 1
}

Write-Host ""
Write-Host "${Blue}🏷️  Tagging images...${Reset}"

# Tag diagram-converter
docker tag docker-diagram-services-diagram-converter:latest $DIAGRAM_CONVERTER_IMAGE
Write-Host "${Green}✅ Tagged: $DIAGRAM_CONVERTER_IMAGE${Reset}"

# Tag confluence-mcp
docker tag docker-diagram-services-confluence-mcp:latest $CONFLUENCE_MCP_IMAGE
Write-Host "${Green}✅ Tagged: $CONFLUENCE_MCP_IMAGE${Reset}"

Write-Host ""
Write-Host "${Blue}⬆️  Pushing images to Docker Hub...${Reset}"

# Push diagram-converter
Write-Host "${Blue}Pushing diagram-converter...${Reset}"
docker push $DIAGRAM_CONVERTER_IMAGE
if ($LASTEXITCODE -eq 0) {
    Write-Host "${Green}✅ Pushed: $DIAGRAM_CONVERTER_IMAGE${Reset}"
} else {
    Write-Host "${Yellow}❌ Failed to push: $DIAGRAM_CONVERTER_IMAGE${Reset}"
    exit 1
}

Write-Host ""
# Push confluence-mcp
Write-Host "${Blue}Pushing confluence-mcp...${Reset}"
docker push $CONFLUENCE_MCP_IMAGE
if ($LASTEXITCODE -eq 0) {
    Write-Host "${Green}✅ Pushed: $CONFLUENCE_MCP_IMAGE${Reset}"
} else {
    Write-Host "${Yellow}❌ Failed to push: $CONFLUENCE_MCP_IMAGE${Reset}"
    exit 1
}

Write-Host ""
Write-Host "${Green}╔════════════════════════════════════════════╗${Reset}"
Write-Host "${Green}║  ✅ All images pushed successfully!        ║${Reset}"
Write-Host "${Green}╚════════════════════════════════════════════╝${Reset}"
Write-Host ""
Write-Host "Your images are now available at:"
Write-Host "  - $DIAGRAM_CONVERTER_IMAGE"
Write-Host "  - $CONFLUENCE_MCP_IMAGE"
Write-Host ""
Write-Host "To pull them on another machine:"
Write-Host "  docker pull $DIAGRAM_CONVERTER_IMAGE"
Write-Host "  docker pull $CONFLUENCE_MCP_IMAGE"
Write-Host ""
Write-Host "Or use docker-compose:"
Write-Host "  docker compose pull"
Write-Host "  docker compose up -d"
Write-Host ""
