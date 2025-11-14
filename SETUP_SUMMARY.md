# Setup Summary

## Current Status ✅

### What's Working
- ✅ **Diagram Converter Service** - Running on http://localhost:3000
  - Converts SVG to PNG
  - Converts Mermaid to PNG
  - Ready to use!

### What's Pending
- ⏸️ **Confluence MCP Service** - Skipped for now (slow build)
  - You can build it later when needed: `docker compose build confluence-mcp`
  - Or run it separately when you need Confluence integration

## Key Changes Made

1. **Generic Mode Support** ✅
   - Setup script now asks if you want to pre-configure credentials
   - Choose `N` for generic mode (work with multiple Confluence instances)
   - Credentials can be provided per-request

2. **Fixed Docker Compose** ✅
   - Changed `docker-compose` to `docker compose` (modern syntax)
   - Fixed npm installation commands in Dockerfiles

3. **Configuration** ✅
   - Created `.env` file with MCP_API_KEY
   - Confluence credentials are optional (generic mode)

## Using the Diagram Converter

### Test it now:
```bash
# Check health
curl http://localhost:3000/health

# Convert a test diagram
cd /home/per/code/docker-diagram-services
./scripts/convert-diagram.sh mermaid workspace/diagrams/test.mmd workspace/diagrams/output.png
```

### API Usage:
```bash
# Convert SVG to PNG
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@your-diagram.svg" \
  -o output.png

# Convert Mermaid to PNG
curl -X POST http://localhost:3000/convert/mermaid2png \
  -H "Content-Type: text/plain" \
  --data-binary "@your-diagram.mmd" \
  -o output.png
```

## When You Need Confluence MCP

If/when you want to use the Confluence MCP service:

```bash
# Build it (this will take 2-3 minutes due to npm dependencies)
cd /home/per/code/docker-diagram-services
docker compose build confluence-mcp

# Start it
docker compose up -d confluence-mcp
```

## Managing Services

```bash
# View status
docker compose ps

# View logs
docker compose logs -f diagram-converter

# Stop services
docker compose stop

# Start services
docker compose up -d

# Restart
docker compose restart
```

## Generic Mode Usage

For using the MCP server with multiple Confluence instances, see:
- [docs/GENERIC_MODE.md](docs/GENERIC_MODE.md)

The key benefit: You can provide different Confluence credentials for each request/instance instead of hardcoding them.

## Next Steps

1. ✅ You can start using the diagram converter immediately
2. Test with your own diagrams in `workspace/diagrams/`
3. When you need Confluence integration, build the MCP service
4. Read [docs/USAGE.md](docs/USAGE.md) for more examples

## Why Was Build Slow?

The confluence-mcp service has heavy dependencies:
- TypeScript compilation
- Puppeteer (for rendering)
- Many npm packages (100+ dependencies)

This is normal for the first build. Subsequent builds use Docker cache and are much faster.

You can:
- Build it in the background: `docker compose build confluence-mcp &`
- Or skip it for now since diagram-converter works independently
