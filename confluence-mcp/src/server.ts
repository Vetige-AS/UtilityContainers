import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { loadConfig } from './utils/config';
import { getDefaultSpaceKey } from './utils/config';
import { ConfluenceClient } from './services/confluence-client';
import { MarkdownConverter } from './services/markdown-converter';
import { MarkdownPageCache } from './utils/cache';
import { ProjectConfigManager } from './utils/project-config';
import crypto from 'crypto';

// Security configuration
const MCP_API_KEY = process.env.MCP_API_KEY;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

// Rate limiting store (in production, use Redis or similar)
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

// Create an MCP server instance with Confluence tools
const getServer = () => {
  const server = new McpServer({
    name: 'confluence-mcp',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
      logging: {}
    }
  });

  // Load configuration on startup
  loadConfig();

  // Register Confluence tools
  server.tool('confluence_list_spaces', 'List all available Confluence spaces', {}, async () => {
    try {
      const client = new ConfluenceClient();
      const spaces = await client.listSpaces();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              spaces: spaces.map(space => ({
                key: space.key,
                name: space.name
              }))
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
              error: error.message || 'Failed to list Confluence spaces'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  server.tool('confluence_list_pages', 'List all pages in a Confluence space', {
    spaceKey: z.string().optional().describe('The key of the Confluence space to list pages from (uses default from config/env if not provided)')
  }, async ({ spaceKey }) => {
    try {
      const projectConfig = new ProjectConfigManager();
      const config = projectConfig.getConfig();
      
      // Use project config default if not provided, then fall back to env default
      const finalSpaceKey = spaceKey || config?.spaceKey || getDefaultSpaceKey();
      
      if (!finalSpaceKey) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'No space key provided. Either:\n' +
                       '1. Pass spaceKey parameter, or\n' +
                       '2. Set up project config with confluence_setup_project, or\n' +
                       '3. Set CONFLUENCE_SPACE_KEY in .env file'
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      const client = new ConfluenceClient();
      const pages = await client.listPages(finalSpaceKey);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pages: pages.map(page => ({
                id: page.id,
                title: page.title,
                spaceKey: page.spaceKey,
                version: page.version.number
              }))
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
              error: error.message || 'Failed to list Confluence pages'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  server.tool('confluence_create_page', 'Create a new Confluence page from Markdown content', {
    title: z.string().describe('The title of the new page'),
    markdownContent: z.string().describe('The Markdown content to be converted and used for the page'),
    markdownPath: z.string().optional().describe('Optional: The path to the Markdown file in the local codebase for caching'),
    spaceKey: z.string().optional().describe('Optional: Override the default space key from project config'),
    parentPageId: z.string().optional().describe('Optional: Override the default parent page from project config')
  }, async ({ title, markdownContent, markdownPath, spaceKey, parentPageId }) => {
    try {
      const projectConfig = new ProjectConfigManager();
      const config = projectConfig.getConfig();

      // Use project config defaults if not provided, then fall back to env default
      const finalSpaceKey = spaceKey || config?.spaceKey || getDefaultSpaceKey();
      const finalParentPageId = parentPageId || config?.parentPageId;

      if (!finalSpaceKey) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'No space key provided. Either:\n' +
                       '1. Pass spaceKey parameter, or\n' +
                       '2. Set up project config with confluence_setup_project, or\n' +
                       '3. Set CONFLUENCE_SPACE_KEY in .env file'
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      const client = new ConfluenceClient();
      const converter = new MarkdownConverter();
      const cache = new MarkdownPageCache();

      // Convert markdown to Confluence format
      const confluenceContent = await converter.convertToConfluence(markdownContent);

      // Create the page (with parent if specified)
      const page = await client.createPage(finalSpaceKey, title, confluenceContent, finalParentPageId);

      // Cache the mapping if markdownPath is provided
      if (markdownPath) {
        cache.setPageMapping(markdownPath, {
          markdownPath,
          pageId: page.id,
          spaceKey: page.spaceKey,
          title: page.title,
          lastUpdated: new Date().toISOString()
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `✅ Page '${title}' created successfully!`,
              page: {
                id: page.id,
                title: page.title,
                spaceKey: page.spaceKey,
                version: page.version,
                parentPageId: finalParentPageId
              }
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
              error: error.message || 'Failed to create Confluence page'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  server.tool('confluence_update_page', 'Update an existing Confluence page from Markdown content', {
    pageId: z.string().describe('The ID of the Confluence page to update'),
    title: z.string().describe('The new title for the page'),
    markdownContent: z.string().describe('The Markdown content to be converted and used for the page'),
    markdownPath: z.string().optional().describe('Optional: The path to the Markdown file in the local codebase for caching'),
    version: z.number().describe('The current version number of the page (required for updates)'),
    parentPageId: z.string().optional().describe('Optional: Override the default parent page from project config')
  }, async ({ pageId, title, markdownContent, markdownPath, version, parentPageId }) => {
    try {
      const projectConfig = new ProjectConfigManager();
      const config = projectConfig.getConfig();

      // Use project config default parent if not provided
      const finalParentPageId = parentPageId || config?.parentPageId;

      const client = new ConfluenceClient();
      const converter = new MarkdownConverter();
      const cache = new MarkdownPageCache();

      // Convert markdown to Confluence format
      const confluenceContent = await converter.convertToConfluence(markdownContent);

      // Update the page (with parent if specified)
      const page = await client.updatePage(pageId, title, confluenceContent, version, finalParentPageId);

      // Update cache mapping if markdownPath is provided
      if (markdownPath) {
        cache.setPageMapping(markdownPath, {
          markdownPath,
          pageId: page.id,
          spaceKey: page.spaceKey,
          title: page.title,
          lastUpdated: new Date().toISOString()
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `✅ Page '${title}' updated successfully!`,
              page: {
                id: page.id,
                title: page.title,
                spaceKey: page.spaceKey,
                version: page.version,
                parentPageId: finalParentPageId
              }
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
              error: error.message || 'Failed to update Confluence page'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  server.tool('confluence_delete_page', 'Delete a Confluence page and remove it from cache', {
    pageId: z.string().describe('The ID of the Confluence page to delete'),
    markdownPath: z.string().optional().describe('Optional: The path to the Markdown file in the local codebase to remove from cache')
  }, async ({ pageId, markdownPath }) => {
    try {
      const client = new ConfluenceClient();
      const cache = new MarkdownPageCache();

      // Delete the page from Confluence
      await client.deletePage(pageId);

      // Remove from cache if markdownPath is provided
      if (markdownPath) {
        cache.removePageMapping(markdownPath);
      } else {
        // If no markdownPath provided, try to find and remove by pageId
        const allMappings = cache.getAllMappings();
        for (const [path, mapping] of Object.entries(allMappings)) {
          if (mapping.pageId === pageId) {
            cache.removePageMapping(path);
            break;
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Page ${pageId} deleted successfully`
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
              error: error.message || 'Failed to delete Confluence page'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  // Add project configuration management tools
  server.tool('confluence_setup_project', 'Set up Confluence project configuration with your specific settings', {
    confluenceUrl: z.string().describe('Confluence base URL (e.g., https://realestatenexus.atlassian.net/)'),
    username: z.string().describe('Confluence username/email'),
    apiToken: z.string().describe('Confluence API token'),
    spaceKey: z.string().describe('Default space key (e.g., ~712020b38176381dd2400481d381324bb1fb50)'),
    parentPageTitle: z.string().optional().describe('Parent page title in hierarchy (e.g., REN360 Microservices Ecosystem)'),
    baseDir: z.string().optional().describe('Local file path mapping (optional)')
  }, async ({ confluenceUrl, username, apiToken, spaceKey, parentPageTitle, baseDir }) => {
    try {
      const projectConfig = new ProjectConfigManager();

      // Update environment variables for immediate use
      process.env.CONFLUENCE_BASE_URL = confluenceUrl;
      process.env.CONFLUENCE_USERNAME = username;
      process.env.CONFLUENCE_API_TOKEN = apiToken;

      // Reload configuration
      loadConfig();

      // Test the connection first
      const client = new ConfluenceClient();

      // Validate space exists
      try {
        const spaces = await client.listSpaces();
        const spaceExists = spaces.some(space => space.key === spaceKey);
        if (!spaceExists) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: `Space with key '${spaceKey}' not found`,
                  availableSpaces: spaces.map(s => ({ key: s.key, name: s.name }))
                }, null, 2)
              }
            ],
            isError: true
          };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to connect to Confluence: ${error.message}`,
                troubleshooting: [
                  'Check your Confluence URL format',
                  'Verify your username/email is correct',
                  'Ensure your API token is valid',
                  'Make sure you have access to the Confluence instance'
                ]
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Find parent page if specified
      let parentPageId: string | undefined;
      if (parentPageTitle) {
        try {
          const pages = await client.listPages(spaceKey);
          const parentPage = pages.find(page => page.title === parentPageTitle);
          if (parentPage) {
            parentPageId = parentPage.id;
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: `Parent page '${parentPageTitle}' not found in space '${spaceKey}'`,
                    availablePages: pages.map(p => ({ id: p.id, title: p.title })).slice(0, 10)
                  }, null, 2)
                }
              ],
              isError: true
            };
          }
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: `Failed to find parent page: ${error.message}`
                }, null, 2)
              }
            ],
            isError: true
          };
        }
      }

      // Save project configuration
      projectConfig.saveConfig({
        confluenceUrl,
        username,
        apiToken,
        spaceKey,
        parentPageTitle,
        parentPageId,
        baseDir
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '✅ Confluence project configuration saved successfully!',
              config: {
                confluenceUrl,
                username: username.replace(/(.{3}).*(@.*)/, '$1***$2'), // Mask email
                spaceKey,
                parentPageTitle,
                parentPageId,
                baseDir
              }
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
              error: error.message || 'Failed to set up Confluence project configuration'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  server.tool('confluence_show_config', 'Show current project configuration', {}, async () => {
    try {
      const projectConfig = new ProjectConfigManager();
      const config = projectConfig.getConfig();

      if (!config) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'No project configuration found. Use confluence_setup_project to configure.',
                configured: false
              }, null, 2)
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              configured: true,
              config: {
                confluenceUrl: config.confluenceUrl,
                username: config.username.replace(/(.{3}).*(@.*)/, '$1***$2'), // Mask email
                spaceKey: config.spaceKey,
                parentPageTitle: config.parentPageTitle,
                parentPageId: config.parentPageId,
                baseDir: config.baseDir,
                lastUpdated: config.lastUpdated
              }
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
              error: error.message || 'Failed to show project configuration'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  server.tool('confluence_test_connection', 'Test Confluence connection', {}, async () => {
    try {
      const client = new ConfluenceClient();
      const spaces = await client.listSpaces();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `✅ Connection successful! Found ${spaces.length} spaces.`,
              spacesCount: spaces.length
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
              error: `❌ Connection failed: ${error.message}`,
              troubleshooting: [
                'Check your Confluence base URL',
                'Verify your username/email is correct',
                'Ensure your API token is valid',
                'Make sure you have access to the Confluence instance'
              ]
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  return server;
};

export function startServer(port: number): void {
  const app = express();

  // Trust proxy for accurate IP addresses (important for Fly.io)
  app.set('trust proxy', true);

  // Apply security middleware
  app.use(securityHeaders);
  app.use(express.json({ limit: '10mb' })); // Limit payload size
  app.use(rateLimitMiddleware);

  // Store transports by session ID
  const transports: Record<string, SSEServerTransport> = {};

  // SSE endpoint for establishing the stream (requires authentication)
  app.get('/mcp', authenticateRequest, async (req, res) => {
    console.log('Received authenticated GET request to /mcp (establishing SSE stream)');
    try {
      // Create a new SSE transport for the client
      // The transport automatically generates its own secure session ID
      const transport = new SSEServerTransport('/messages', res);

      // Get the session ID from the transport (it's a read-only property)
      const sessionId = transport.sessionId;

      // Store the transport by session ID
      transports[sessionId] = transport;

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        console.log(`SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };

      // Connect the transport to the MCP server
      const server = getServer();
      await server.connect(transport);
      console.log(`Established SSE stream with session ID: ${sessionId}`);
    } catch (error) {
      console.error('Error establishing SSE stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });

  // Messages endpoint for receiving client JSON-RPC requests (requires authentication)
  app.post('/messages', authenticateRequest, async (req, res) => {
    console.log('Received authenticated POST request to /messages');

    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      console.error('No session ID provided in request URL');
      res.status(400).send('Missing sessionId parameter');
      return;
    }

    const transport = transports[sessionId];
    if (!transport) {
      console.error(`No active transport found for session ID: ${sessionId}`);
      res.status(404).send('Session not found');
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Agent definition endpoint
  app.get('/agent', (_req, res) => {
    const agentDefinition = `---
description: Publish and manage documentation on Confluence using the MCP server
name: confluence-publisher
argument-hint: Specify what to publish or which Confluence instance to use
tools: ['edit', 'search', 'usages']
target: vscode
---

# Confluence Publishing Agent

You are a specialized agent for publishing documentation to Confluence using the Confluence MCP server.

## Your Capabilities

You can:
- Create new Confluence pages from Markdown
- Update existing Confluence pages
- List Confluence spaces and pages
- Convert diagrams before publishing
- Manage multiple Confluence instances (generic mode)
- Test Confluence connections

## Available Services

### Confluence MCP Server
- **URL (from devcontainer)**: \`http://confluence-mcp:3001\`
- **URL (from host)**: \`http://localhost:3001\`
- **Health check**: \`GET /health\`
- **MCP endpoint**: \`GET /mcp\` (with x-mcp-api-key header)
- **Agent definition**: \`GET /agent\`
- **Requires**: MCP_API_KEY environment variable

### Diagram Converter Service
- **URL (from devcontainer)**: \`http://diagram-converter:3000\`
- **URL (from host)**: \`http://localhost:3000\`

## MCP Server Tools

The Confluence MCP server provides these tools:

1. **confluence_setup_project** - Configure Confluence credentials and defaults
2. **confluence_test_connection** - Test Confluence connection
3. **confluence_show_config** - Show current configuration
4. **confluence_list_spaces** - List all Confluence spaces
5. **confluence_list_pages** - List pages in a space
6. **confluence_create_page** - Create a new page from Markdown
7. **confluence_update_page** - Update an existing page
8. **confluence_delete_page** - Delete a page

## Generic Mode (Multiple Confluence Instances)

The MCP server supports working with multiple Confluence instances. Credentials can be:
- Provided per-request in tool arguments
- Set via environment variables (default for all requests)
- Configured per-project using \`confluence_setup_project\`

## Workflow Instructions

### When asked to publish to Confluence:

1. **Verify MCP server availability**
   \`\`\`bash
   curl http://confluence-mcp:3001/health
   \`\`\`

2. **Check/Setup Confluence configuration**
   - Use \`confluence_show_config\` to check if configured
   - If not configured, use \`confluence_setup_project\` to set up
   - For generic mode, get credentials from user for specific instance

3. **Prepare content**
   - Convert any diagrams to PNG first (use diagram-converter or @diagram-converter agent)
   - Read the markdown file to publish
   - Update image references if diagrams were converted

4. **Create or update page**
   - Use \`confluence_list_spaces\` to find the target space
   - Optionally use \`confluence_list_pages\` to find parent page or check if page exists
   - Use \`confluence_create_page\` for new pages
   - Use \`confluence_update_page\` for existing pages (requires version number)

5. **Verify and report**
   - Confirm successful creation/update
   - Provide the Confluence page URL
   - List any issues encountered

## Multi-Instance Workflow

When working with multiple Confluence instances:

1. **Ask which instance** if not specified
   - Company/client name
   - Confluence URL
   - Space to publish to

2. **Get or request credentials**
   - Check if default credentials are set
   - If not, ask user for: baseUrl, username, apiToken
   - Store temporarily for this session or suggest setting defaults

3. **Include instance info in all operations**
   - Always pass confluence credentials with tool calls
   - Or ensure correct environment variables are set

## Best Practices

1. **Always test connection first** when working with a new instance
2. **Convert diagrams before publishing** to ensure images display correctly
3. **Use parent pages** to organize content hierarchically
4. **Cache page mappings** by providing markdownPath parameter
5. **Verify space access** before attempting to create pages
6. **Provide clear status updates** during long operations
7. **Handle multiple instances gracefully** - always confirm which instance

## Integration with Diagram Agent

You can delegate diagram conversion to the @diagram-converter agent:
- Use @diagram-converter when asked to publish content with diagrams
- Or call diagram-converter service directly before publishing
- Always update image paths in markdown before sending to Confluence

## Security Notes

- Never log or expose API tokens
- Validate Confluence URLs before connecting
- Confirm destructive operations (delete, major updates)
- Warn user if publishing to production spaces

Remember: You work with the MCP server which handles the Confluence API. Focus on orchestrating the workflow, preparing content, and providing clear status updates to the user.`;

    res.setHeader('Content-Type', 'text/markdown');
    res.send(agentDefinition);
  });

  // VS Code MCP settings endpoint
  app.get('/mcp/vscode', (req, res) => {
    const host = req.get('host') || 'localhost:3001';
    const protocol = req.protocol;
    const isDevcontainer = req.query.devcontainer === 'true';
    const projectName = req.query.project || '';
    
    // Determine the correct URL based on context
    let serverUrl: string;
    let displayName: string;
    
    if (isDevcontainer) {
      const containerName = projectName ? `${projectName}-confluence-mcp` : 'confluence-mcp';
      serverUrl = `http://${containerName}:3001/mcp`;
      displayName = projectName ? `Confluence MCP (${projectName})` : 'Confluence MCP';
    } else {
      serverUrl = `${protocol}://${host}/mcp`;
      displayName = 'Confluence MCP (localhost)';
    }

    const mcpSettings = {
      "mcpServers": {
        [projectName ? `confluence-${projectName}` : 'confluence']: {
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
curl ${protocol}://${host}/mcp/vscode${isDevcontainer ? '?devcontainer=true' : ''}${projectName ? `&project=${projectName}` : ''} | jq '.mcpServers' > .vscode/mcp-settings.json
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

**User settings (~/.vscode/settings.json):**
For global availability across all projects.

## Manual Configuration

Add this to your VS Code settings.json:

\`\`\`json
${JSON.stringify(mcpSettings, null, 2)}
\`\`\`

## How It Works

**Transport**: Server-Sent Events (SSE)
- The MCP server uses SSE for real-time communication
- VS Code establishes a persistent connection to receive updates

**Tool Discovery**: Automatic
- The MCP server automatically advertises available tools
- VS Code discovers tools via the MCP protocol
- No need to manually list tools in configuration

**Authentication**: API Key Header
- Each request includes \`x-mcp-api-key\` header
- Validates access to the MCP server

## Environment Variable

Replace \`\${MCP_API_KEY}\` with your actual API key, or set it as an environment variable:

**Option 1: Direct replacement**
\`\`\`json
"headers": {
  "x-mcp-api-key": "your-actual-api-key-here"
}
\`\`\`

**Option 2: Environment variable (recommended)**
1. Add to your shell profile (~/.bashrc, ~/.zshrc):
   \`\`\`bash
   export MCP_API_KEY="your-api-key-here"
   \`\`\`

2. Restart VS Code or reload window

3. VS Code will automatically substitute \${MCP_API_KEY}

## Get Your API Key

\`\`\`bash
# From .env file
cat .env | grep MCP_API_KEY

# Or generate a new one
openssl rand -hex 32
\`\`\`

## Connection Details

- **Server URL**: ${serverUrl}
- **Transport**: Server-Sent Events (SSE)
- **Authentication**: x-mcp-api-key header
- **Tool Discovery**: Automatic via MCP protocol
- **Context**: ${isDevcontainer ? 'Devcontainer' : 'Host machine'}${projectName ? ` (Project: ${projectName})` : ''}

## Available Tools

Tools are discovered automatically via MCP. Current tools include:

1. \`confluence_setup_project\` - Configure Confluence credentials
2. \`confluence_test_connection\` - Test connection
3. \`confluence_show_config\` - Show current config
4. \`confluence_list_spaces\` - List Confluence spaces
5. \`confluence_list_pages\` - List pages in a space
6. \`confluence_create_page\` - Create new page from Markdown
7. \`confluence_update_page\` - Update existing page
8. \`confluence_delete_page\` - Delete a page

**Note**: This list is for reference only. VS Code will automatically discover all available tools.

## Verification

After configuration:
1. Reload VS Code window (Ctrl+Shift+P → "Reload Window")
2. Open Command Palette (Ctrl+Shift+P)
3. Type "MCP" to see available MCP commands
4. Test with: "MCP: List Available Servers"

## Troubleshooting

**Server not appearing:**
- Check settings.json syntax is valid
- Verify MCP_API_KEY is set correctly
- Restart VS Code completely

**Connection failed:**
- Ensure MCP server is running: \`curl ${protocol}://${host}/health\`
- Check API key matches: \`cat .env | grep MCP_API_KEY\`
- Verify network connectivity ${isDevcontainer ? '(check dev-network)' : ''}

**Tools not working:**
- Test connection: \`confluence_test_connection\`
- Setup project: \`confluence_setup_project\`
- Check logs in MCP server container: \`docker logs confluence-mcp\`

## Multi-Project Setup

For multiple projects with different Confluence instances:

\`\`\`bash
# Project A
curl http://localhost:3001/mcp/vscode?project=project-a > .vscode/mcp-project-a.json

# Project B  
curl http://localhost:3002/mcp/vscode?project=project-b > .vscode/mcp-project-b.json
\`\`\`

Then merge all into settings.json under \`"mcp.servers"\`.
`;

    // Return both JSON config and markdown instructions
    if (req.accepts('json')) {
      res.json({
        config: mcpSettings,
        instructions: instructions,
        serverUrl: serverUrl,
        apiKeyPlaceholder: '${MCP_API_KEY}',
        context: {
          isDevcontainer,
          projectName,
          host
        }
      });
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(instructions + '\n\n## JSON Configuration\n\n```json\n' + JSON.stringify(mcpSettings, null, 2) + '\n```');
    }
  });

  // Start the server
  app.listen(port, () => {
    console.log(`Confluence MCP SSE server running on port ${port}`);
  });

  // Handle server shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    for (const sessionId in transports) {
      try {
        console.log(`Closing transport for session ${sessionId}`);
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    console.log('Server shutdown complete');
    process.exit(0);
  });
}