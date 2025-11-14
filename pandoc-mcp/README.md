# Pandoc MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to convert documents between various formats using Pandoc.

## Features

- 🔄 **SSE Server**: Real-time Server-Sent Events for live progress updates
- 📝 **Multi-Format Support**: Convert between 40+ document formats
- 🎨 **Rich Options**: Templates, TOC, syntax highlighting, and more
- 🔒 **Secure Authentication**: MCP API token authentication
- 🐳 **Docker Ready**: Optimized container with Pandoc pre-installed

## Tools Available

- `pandoc_convert` - Convert text content between formats
- `pandoc_convert_file` - Convert files between formats
- `pandoc_info` - Get Pandoc version and supported formats

## Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd pandoc-mcp
npm install
```

### 2. Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
MCP_API_KEY=your-generated-api-key-here
PORT=3002
```

Generate an API key:

```bash
npm run generate-key
```

### 3. Run the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The server will be available at `http://localhost:3002`

## Usage Examples

### Convert Markdown to HTML

```json
{
  "tool": "pandoc_convert",
  "input": "# Hello World\n\nThis is **bold** text.",
  "inputFormat": "markdown",
  "outputFormat": "html",
  "standalone": true
}
```

### Convert Markdown File to PDF

```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "docs/readme.md",
  "outputPath": "output/readme.pdf",
  "standalone": true,
  "toc": true,
  "numberSections": true
}
```

### Get Pandoc Information

```json
{
  "tool": "pandoc_info"
}
```

## Supported Formats

### Input Formats
- markdown (GitHub-flavored, CommonMark, etc.)
- html
- docx (Microsoft Word)
- odt (OpenDocument)
- latex
- rst (reStructuredText)
- textile, mediawiki, org
- And many more...

### Output Formats
- html (HTML5)
- pdf (via LaTeX)
- docx (Microsoft Word)
- odt (OpenDocument)
- epub (E-books)
- latex, beamer
- markdown, rst
- plain text
- And many more...

## API Endpoints

### MCP Endpoints

- `GET /mcp` - Establish SSE connection for MCP protocol
- `POST /messages` - Send MCP messages (requires sessionId)

### Utility Endpoints

- `GET /health` - Server health status
- `GET /agent` - VS Code agent definition
- `GET /mcp/vscode` - VS Code MCP configuration

## Docker Usage

### Dockerfile Options

This container comes with two Dockerfile options:

1. **Dockerfile** (default, ~300MB)
   - Includes Pandoc without LaTeX
   - Supports most conversions (HTML, DOCX, Markdown, etc.)
   - Does NOT support PDF output
   - Quick to build (~2-3 minutes)

2. **Dockerfile.full** (~800MB)
   - Includes Pandoc with full LaTeX support
   - Supports all conversions including PDF
   - Longer build time (~5-10 minutes)

### Build the Image

**Standard build (no PDF support):**
```bash
docker build -t pandoc-mcp .
```

**Full build (with PDF support):**
```bash
docker build -f Dockerfile.full -t pandoc-mcp .
```

### Run the Container

```bash
docker run -d \
  --name pandoc-mcp \
  -p 3002:3002 \
  -v $(pwd)/workspace:/workspace \
  -e MCP_API_KEY=your-api-key \
  pandoc-mcp
```

### Using Docker Compose

See the main repository's `docker-compose.yml` for integration with other services.

To use the full version with PDF support, update docker-compose.yml:
```yaml
pandoc-mcp:
  build:
    context: ./pandoc-mcp
    dockerfile: Dockerfile.full  # Use full version
```

## Development

### Project Structure

```
pandoc-mcp/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # MCP server with SSE support
│   ├── services/
│   │   └── pandoc-service.ts # Pandoc conversion service
│   ├── utils/
│   │   └── config.ts         # Configuration management
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── scripts/
│   └── generate-api-key.js   # API key generator
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Building

```bash
npm run build
```

### Testing

```bash
# Test health endpoint
curl http://localhost:3002/health

# Test SSE connection
curl -H "x-mcp-api-key: your-api-key" -N http://localhost:3002/mcp

# Get agent definition
curl http://localhost:3002/agent

# Get VS Code configuration
curl http://localhost:3002/mcp/vscode
```

## VS Code Integration

### Fetch Configuration

```bash
# For host machine
curl http://localhost:3002/mcp/vscode > pandoc-mcp-config.md

# For devcontainer
curl http://localhost:3002/mcp/vscode?devcontainer=true > pandoc-mcp-config.md

# Get JSON format
curl -H "Accept: application/json" http://localhost:3002/mcp/vscode
```

### Manual VS Code Setup

Add to `.vscode/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "pandoc": {
        "url": "http://localhost:3002/mcp",
        "transport": {
          "type": "sse"
        },
        "headers": {
          "x-mcp-api-key": "${env:MCP_API_KEY}"
        },
        "description": "Pandoc MCP Server"
      }
    }
  }
}
```

## Advanced Options

### Conversion Options

All conversion tools support:

- `standalone`: Produce complete document with headers
- `toc`: Include table of contents
- `tocDepth`: TOC depth (1-6)
- `numberSections`: Number document sections
- `highlightStyle`: Code syntax highlighting style
- `template`: Custom template file
- `variables`: Template variables
- `metadata`: Document metadata
- `extraArgs`: Additional Pandoc arguments

### Example with Advanced Options

```json
{
  "tool": "pandoc_convert_file",
  "inputPath": "docs/technical.md",
  "outputPath": "output/technical.pdf",
  "standalone": true,
  "toc": true,
  "tocDepth": 3,
  "numberSections": true,
  "highlightStyle": "tango",
  "metadata": {
    "title": "Technical Documentation",
    "author": "Your Name",
    "date": "2024"
  }
}
```

## Security

- API key authentication required for all MCP operations
- Rate limiting (100 requests per 15 minutes)
- Security headers enabled
- File operations restricted to workspace directory
- Input sanitization and validation

## Troubleshooting

### Container Can't Access Files

Ensure workspace volume is mounted:
```bash
docker run -v /path/to/workspace:/workspace pandoc-mcp
```

### PDF Conversion Fails

LaTeX is required for PDF output. It's included in the Docker image but may need additional packages for complex documents.

### Port Already in Use

Change the port in `.env`:
```env
PORT=3003
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
