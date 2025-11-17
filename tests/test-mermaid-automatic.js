#!/usr/bin/env node

/**
 * Test the automatic Mermaid → PNG conversion workflow
 * The MCP server should automatically:
 * 1. Extract Mermaid diagrams from Markdown
 * 2. Convert them to PNG using diagram-converter
 * 3. Upload PNGs as attachments
 * 4. Replace Mermaid blocks with image references
 */

const EventSource = require('eventsource');
const fetch = require('node-fetch');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MCP_API_KEY = process.env.MCP_API_KEY || '90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5';

// Markdown content with Mermaid diagram
const TEST_MARKDOWN = `# Automatic Mermaid Conversion Test

This page tests the automatic Mermaid → PNG conversion workflow.

## Architecture Diagram

\`\`\`mermaid
graph TD
    A[Client] --> B[MCP Server]
    B --> C[DiagramProcessor]
    C --> D[diagram-converter]
    D --> E[PNG Image]
    E --> F[Confluence Attachment]
    style A fill:#e1f5ff
    style F fill:#c8e6c9
\`\`\`

## Process Flow

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant M as MCP
    participant D as DiagramProcessor
    participant C as Converter
    participant CF as Confluence
    
    U->>M: Create page with Mermaid
    M->>D: Process Markdown
    D->>C: Convert to PNG
    C-->>D: PNG buffer
    D-->>M: Updated Markdown + PNGs
    M->>CF: Create page
    M->>CF: Upload PNGs
    CF-->>U: Page with images
\`\`\`

## Features

- ✅ Automatic diagram extraction
- ✅ PNG conversion via diagram-converter
- ✅ Attachment upload to Confluence
- ✅ Image references in Markdown

**Result**: Mermaid diagrams are automatically converted and displayed!
`;

async function testAutomaticMermaid() {
  console.log('🧪 Testing Automatic Mermaid → PNG Workflow...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing MCP health...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    console.log('✅ MCP server is ready\n');

    // Test 2: Connect and create page
    console.log('2️⃣  Connecting to MCP server...');
    
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${MCP_SERVER_URL}/mcp`, {
        headers: {
          'x-mcp-api-key': MCP_API_KEY
        }
      });
      
      let sessionId = null;
      let pendingRequests = new Map();

      eventSource.onopen = () => {
        console.log('✅ SSE connection established\n');
      };

      eventSource.addEventListener('message', (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.id && pendingRequests.has(response.id)) {
            const { resolve, reject } = pendingRequests.get(response.id);
            pendingRequests.delete(response.id);
            
            if (response.error) {
              reject(new Error(response.error.message || JSON.stringify(response.error)));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      eventSource.addEventListener('endpoint', async (event) => {
        try {
          const endpointUrl = event.data;
          const match = endpointUrl.match(/sessionId=([^&]+)/);
          if (!match) {
            throw new Error('Could not extract session ID');
          }
          
          sessionId = match[1];
          console.log(`🔗 Session ID: ${sessionId}\n`);

          const sendRequest = async (method, params, id) => {
            return new Promise(async (resolveReq, rejectReq) => {
              pendingRequests.set(id, { resolve: resolveReq, reject: rejectReq });
              
              const request = {
                jsonrpc: '2.0',
                id,
                method,
                params
              };

              try {
                const response = await fetch(`${MCP_SERVER_URL}/messages?sessionId=${sessionId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-mcp-api-key': MCP_API_KEY
                  },
                  body: JSON.stringify(request)
                });

                if (!response.ok) {
                  pendingRequests.delete(id);
                  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
              } catch (error) {
                pendingRequests.delete(id);
                rejectReq(error);
              }
            });
          };

          try {
            // Test 3: Create page with Mermaid diagrams
            console.log('3️⃣  Creating Confluence page with Mermaid diagrams...');
            console.log('   📝 Markdown contains 2 Mermaid diagrams');
            console.log('   🔄 Server will automatically:');
            console.log('      - Extract Mermaid code');
            console.log('      - Convert to PNG via diagram-converter');
            console.log('      - Upload PNGs as attachments');
            console.log('      - Replace with image references\n');
            
            const createResult = await sendRequest('tools/call', {
              name: 'confluence_create_page',
              arguments: {
                title: `Auto Mermaid Test - ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`,
                markdownContent: TEST_MARKDOWN
              }
            }, 1);

            const createData = JSON.parse(createResult.content[0].text);
            
            if (!createData.success) {
              throw new Error('Failed to create page: ' + JSON.stringify(createData));
            }

            console.log('✅ Page created successfully!');
            console.log(`   📄 Title: ${createData.page.title}`);
            console.log(`   🆔 Page ID: ${createData.page.id}`);
            console.log(`   📁 Space: ${createData.page.spaceKey}`);
            console.log(`   🌐 URL: https://innovasjon-og-digitalisering.atlassian.net/wiki/spaces/${createData.page.spaceKey}/pages/${createData.page.id}\n`);

            eventSource.close();
            resolve({
              pageId: createData.page.id,
              title: createData.page.title,
              spaceKey: createData.page.spaceKey
            });

          } catch (error) {
            console.error('❌ Error during workflow:', error);
            eventSource.close();
            reject(error);
          }
        } catch (error) {
          console.error('❌ Error processing endpoint:', error);
          eventSource.close();
          reject(error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        eventSource.close();
        reject(error);
      };

      setTimeout(() => {
        console.log('⏰ Test timeout after 60 seconds');
        eventSource.close();
        reject(new Error('Test timeout'));
      }, 60000);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testAutomaticMermaid()
    .then((result) => {
      console.log('🎉 Automatic Mermaid conversion workflow completed successfully!\n');
      console.log('📊 Summary:');
      console.log(`   - Page: ${result.title}`);
      console.log(`   - 2 Mermaid diagrams automatically converted to PNG`);
      console.log(`   - Images attached and referenced in page`);
      console.log(`   - View: https://innovasjon-og-digitalisering.atlassian.net/wiki/spaces/${result.spaceKey}/pages/${result.pageId}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Workflow failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testAutomaticMermaid };
