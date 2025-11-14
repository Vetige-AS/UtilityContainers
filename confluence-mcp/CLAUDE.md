# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Confluence MCP (Model Context Protocol) Server that enables AI assistants to interact with Atlassian Confluence. It uses Server-Sent Events (SSE) for real-time communication and provides tools for managing Confluence documentation.

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run production server
npm start

# Development with hot reload
npm run dev

# Test server health and SSE connection
node simple-test.js

# Test MCP protocol integration
node test-mcp.js
```

## Architecture

The server consists of three main layers:

1. **MCP Server** (`src/server.ts`): Handles SSE transport and tool registration
2. **Services**:
   - `ConfluenceClient`: Confluence API interactions
   - `MarkdownConverter`: Converts Markdown to Confluence storage format with professional styling
   - `MermaidRenderer`: Renders Mermaid diagrams to PNG using Puppeteer
3. **HTTP Server** (`src/index.ts`): Express server providing SSE endpoints

## Required Environment Variables

```bash
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
MCP_API_KEY=optional-api-key  # Optional
PORT=3001  # Optional, defaults to 3001
```

## Key Implementation Details

- **SSE Sessions**: Each client gets a unique session ID with dedicated transport
- **Markdown Features**: Supports Mermaid diagrams, callouts, TOC, and applies Confluence design tokens
- **Caching**: Local markdown files are mapped to Confluence pages in `markdown-page-mapping.json`
- **Configuration**: Project settings stored in `confluence-project-config.json`

## Testing

This project uses manual integration tests rather than a formal testing framework:
- `simple-test.js`: Basic HTTP and SSE endpoint testing
- `test-mcp.js`: Full MCP protocol testing
- No unit tests - add Jest or similar if needed

## Deployment

The project is configured for Fly.io deployment with `fly.toml`. See DEPLOYMENT.md for detailed instructions.