import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { loadConfig, getMcpApiKey } from './utils/config';
import { PandocService } from './services/pandoc-service';
import crypto from 'crypto';

// Security configuration
const MCP_API_KEY = getMcpApiKey();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Authentication middleware
function authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['x-mcp-api-key'] || req.query.apiKey;

  if (!MCP_API_KEY) {
    console.error('MCP_API_KEY not configured on server');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== MCP_API_KEY) {
    console.warn('Unauthorized access attempt:', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  next();
}

// Rate limiting middleware
function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientId = req.ip || 'unknown';
  const now = Date.now();

  // Clean up expired entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }

  const clientData = rateLimitStore.get(clientId);

  if (!clientData) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  if (now > clientData.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }

  clientData.count++;
  next();
}

// Security headers middleware
function securityHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
}

// Generate a secure session ID
function generateSecureSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create an MCP server instance with Pandoc tools
const getServer = () => {
  const config = loadConfig();
  const pandocService = new PandocService(config);

  const server = new McpServer({
    name: 'pandoc-mcp',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
      logging: {}
    }
  });

  // Tool: Convert text content using Pandoc
  server.tool(
    'pandoc_convert',
    'Convert text content from one format to another using Pandoc',
    {
      input: z.string().describe('Input text content to convert'),
      inputFormat: z.string().optional().describe('Input format (e.g., markdown, html, latex)'),
      outputFormat: z.string().optional().describe('Output format (e.g., html, pdf, docx)'),
      standalone: z.boolean().optional().describe('Produce standalone document with header/footer'),
      toc: z.boolean().optional().describe('Include table of contents'),
      tocDepth: z.number().optional().describe('Table of contents depth (1-6)'),
      numberSections: z.boolean().optional().describe('Number sections in output'),
      highlightStyle: z.string().optional().describe('Syntax highlighting style'),
      template: z.string().optional().describe('Custom template file path'),
      variables: z.record(z.string()).optional().describe('Template variables'),
      metadata: z.record(z.any()).optional().describe('Document metadata'),
      extraArgs: z.array(z.string()).optional().describe('Additional Pandoc arguments')
    },
    async ({ input, ...options }) => {
      try {
        const result = await pandocService.convert(input, options);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: result.error
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                output: result.output,
                format: result.format
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message || 'Conversion failed'
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: Convert file using Pandoc
  server.tool(
    'pandoc_convert_file',
    'Convert a file from one format to another using Pandoc',
    {
      inputPath: z.string().describe('Input file path (relative to workspace or absolute)'),
      outputPath: z.string().describe('Output file path (relative to workspace or absolute)'),
      inputFormat: z.string().optional().describe('Input format (auto-detected if not specified)'),
      outputFormat: z.string().optional().describe('Output format (inferred from output file extension if not specified)'),
      standalone: z.boolean().optional().describe('Produce standalone document with header/footer'),
      toc: z.boolean().optional().describe('Include table of contents'),
      tocDepth: z.number().optional().describe('Table of contents depth (1-6)'),
      numberSections: z.boolean().optional().describe('Number sections in output'),
      highlightStyle: z.string().optional().describe('Syntax highlighting style'),
      template: z.string().optional().describe('Custom template file path'),
      variables: z.record(z.string()).optional().describe('Template variables'),
      metadata: z.record(z.any()).optional().describe('Document metadata'),
      extraArgs: z.array(z.string()).optional().describe('Additional Pandoc arguments')
    },
    async ({ inputPath, outputPath, ...options }) => {
      try {
        const result = await pandocService.convertFile(inputPath, outputPath, options);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: result.error
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `File converted successfully: ${inputPath} -> ${outputPath}`,
                outputPath: outputPath,
                format: result.format
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message || 'File conversion failed'
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: Get Pandoc version and capabilities
  server.tool(
    'pandoc_info',
    'Get Pandoc version and list of supported formats',
    {},
    async () => {
      try {
        const [version, inputFormats, outputFormats] = await Promise.all([
          pandocService.getVersion(),
          pandocService.listInputFormats(),
          pandocService.listOutputFormats()
        ]);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                version,
                inputFormats,
                outputFormats,
                defaultInputFormat: config.defaultInputFormat,
                defaultOutputFormat: config.defaultOutputFormat
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message || 'Failed to get Pandoc info'
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  return server;
};

export function startServer(port: number): void {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', true);

  // Apply security middleware
  app.use(securityHeaders);
  app.use(express.json({ limit: '10mb' }));
  app.use(rateLimitMiddleware);

  // Store transports by session ID
  const transports: Record<string, SSEServerTransport> = {};

  // SSE endpoint for establishing the stream (requires authentication)
  app.get('/mcp', authenticateRequest, async (req, res) => {
    console.log('Received authenticated GET request to /mcp (establishing SSE stream)');
    try {
      // Generate a secure session ID
      const secureSessionId = generateSecureSessionId();

      // Create a new SSE transport for the client
      const transport = new SSEServerTransport('/messages', res);

      // Override the session ID with our secure one
      (transport as any).sessionId = secureSessionId;

      // Store the transport by session ID
      transports[secureSessionId] = transport;

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        console.log(`SSE transport closed for session ${secureSessionId}`);
        delete transports[secureSessionId];
      };

      // Get the MCP server and connect it to the transport
      const mcpServer = getServer();
      await mcpServer.connect(transport);
      console.log(`MCP server connected for session ${secureSessionId}`);
    } catch (error) {
      console.error('Error establishing SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to establish SSE connection' });
      }
    }
  });

  // POST endpoint for receiving messages (requires authentication)
  app.post('/messages', authenticateRequest, async (req, res) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId || !transports[sessionId]) {
      return res.status(400).json({ error: 'Invalid or missing sessionId' });
    }

    try {
      const transport = transports[sessionId];
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error('Error handling message:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to handle message' });
      }
    }
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'pandoc-mcp',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    });
  });

  // Agent definition endpoint
  app.get('/agent', (_req, res) => {
    const agentDefinition = `---
description: Convert documents using Pandoc MCP server
name: pandoc-converter
argument-hint: Specify document to convert and target format
tools: ['edit', 'search', 'usages']
target: vscode
---

# Pandoc Document Converter Agent

You are a specialized agent for converting documents using the Pandoc MCP server.

## Your Capabilities

You can:
- Convert text content between various formats
- Convert files between formats
- Get information about supported formats
- Access Pandoc's extensive conversion capabilities

## Available Services

### Pandoc MCP Server
- **URL (from devcontainer)**: \`http://pandoc-mcp:3002\`
- **URL (from host)**: \`http://localhost:3002\`
- **Health check**: \`GET /health\`
- **MCP endpoint**: \`GET /mcp\` (with x-mcp-api-key header)
- **Agent definition**: \`GET /agent\`
- **Requires**: MCP_API_KEY environment variable

## MCP Server Tools

The Pandoc MCP server provides these tools:

1. **pandoc_convert** - Convert text content from one format to another
2. **pandoc_convert_file** - Convert a file from one format to another
3. **pandoc_info** - Get Pandoc version and list of supported formats

## Supported Formats

### Common Input Formats
- markdown (including GitHub-flavored)
- html
- latex
- docx (Microsoft Word)
- odt (OpenDocument)
- rst (reStructuredText)
- textile
- mediawiki
- org (Emacs Org-mode)

### Common Output Formats
- html (HTML5)
- pdf (via LaTeX)
- docx (Microsoft Word)
- odt (OpenDocument)
- epub (E-book)
- latex
- markdown
- rst
- plain text

## Workflow Instructions

### When asked to convert a document:

1. **Check format support**
   \`\`\`bash
   # Use pandoc_info tool to see all supported formats
   \`\`\`

2. **For text conversion**
   - Use \`pandoc_convert\` tool
   - Specify input text and desired formats
   - Add options like standalone, toc, etc. as needed

3. **For file conversion**
   - Use \`pandoc_convert_file\` tool
   - Provide input and output file paths
   - Formats can be auto-detected from file extensions
   - Output directory will be created if needed

4. **Advanced options**
   - Use \`standalone: true\` for complete documents
   - Use \`toc: true\` to include table of contents
   - Use \`numberSections: true\` to number sections
   - Specify \`highlightStyle\` for code syntax highlighting
   - Add custom templates and variables as needed

## Examples

### Convert Markdown to HTML
\`\`\`typescript
{
  "input": "# Hello\\n\\nThis is **bold** text.",
  "inputFormat": "markdown",
  "outputFormat": "html",
  "standalone": true
}
\`\`\`

### Convert Markdown file to PDF
\`\`\`typescript
{
  "inputPath": "docs/readme.md",
  "outputPath": "output/readme.pdf",
  "standalone": true,
  "toc": true
}
\`\`\`

### Convert DOCX to Markdown
\`\`\`typescript
{
  "inputPath": "document.docx",
  "outputPath": "document.md"
}
\`\`\`

## Best Practices

1. **Always verify format support** using pandoc_info before conversion
2. **Use standalone mode** for complete documents (HTML, LaTeX, etc.)
3. **Specify formats explicitly** when auto-detection might be ambiguous
4. **Use workspace paths** for file operations (relative to /workspace)
5. **Check conversion results** and report any errors clearly
6. **Add TOC for long documents** to improve navigation
7. **Use templates** for consistent styling across conversions

## Security Notes

- File paths are restricted to workspace directory for safety
- Large documents may take time to convert (especially to PDF)
- PDF conversion requires LaTeX to be installed (included in container)

Remember: You work with the Pandoc MCP server which handles document conversion. Focus on preparing inputs, selecting appropriate formats and options, and providing clear results to the user.`;

    res.setHeader('Content-Type', 'text/markdown');
    res.send(agentDefinition);
  });

  // VS Code MCP settings endpoint
  app.get('/mcp/vscode', (req, res) => {
    const host = req.get('host') || 'localhost:3002';
    const protocol = req.protocol;
    const isDevcontainer = req.query.devcontainer === 'true';
    const projectName = req.query.project || '';
    
    // Determine the correct URL based on context
    let serverUrl: string;
    let displayName: string;
    
    if (isDevcontainer) {
      const containerName = projectName ? `${projectName}-pandoc-mcp` : 'pandoc-mcp';
      serverUrl = `http://${containerName}:3002/mcp`;
      displayName = projectName ? `Pandoc MCP (${projectName})` : 'Pandoc MCP';
    } else {
      serverUrl = `${protocol}://${host}/mcp`;
      displayName = 'Pandoc MCP (localhost)';
    }

    const mcpSettings = {
      "mcpServers": {
        [projectName ? `pandoc-${projectName}` : 'pandoc']: {
          "url": serverUrl,
          "transport": {
            "type": "sse"
          },
          "headers": {
            "x-mcp-api-key": "${MCP_API_KEY}"
          },
          "description": displayName
        }
      }
    };

    const instructions = `# VS Code MCP Server Configuration

## Automatic Setup (Recommended)

Save this configuration to your VS Code settings:

**Workspace settings (.vscode/settings.json):**
\`\`\`bash
curl ${protocol}://${host}/mcp/vscode${isDevcontainer ? '?devcontainer=true' : ''}${projectName ? `&project=${projectName}` : ''} -H "Accept: application/json" | jq '.config' > .vscode/mcp-settings.json
\`\`\`

Then merge into your .vscode/settings.json:
\`\`\`json
{
  "mcp": {
    "servers": {
      // Copy the contents from mcp-settings.json here
    }
  }
}
\`\`\`

## Manual Configuration

Add this to your VS Code settings.json:

\`\`\`json
${JSON.stringify(mcpSettings, null, 2)}
\`\`\`

## Environment Variables

Set your MCP_API_KEY environment variable:

\`\`\`bash
export MCP_API_KEY="your-api-key-here"
\`\`\`

## Verification

Test the connection:
\`\`\`bash
curl ${serverUrl.replace('/mcp', '/health')}
\`\`\`
`;

    // Return based on Accept header
    const acceptHeader = req.headers.accept;
    if (acceptHeader?.includes('application/json')) {
      res.json({
        config: mcpSettings,
        instructions,
        serverUrl,
        apiKeyPlaceholder: '${MCP_API_KEY}',
        context: {
          isDevcontainer,
          projectName,
          host
        }
      });
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(instructions);
    }
  });

  // Start the server
  app.listen(port, () => {
    console.log(`Pandoc MCP server listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`Agent definition: http://localhost:${port}/agent`);
    console.log(`VS Code config: http://localhost:${port}/mcp/vscode`);
  });
}
