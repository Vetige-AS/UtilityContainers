#!/usr/bin/env node

/**
 * Test Confluence integration - connects to real Confluence and creates a test page
 */

const EventSource = require('eventsource');
const fetch = require('node-fetch');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MCP_API_KEY = process.env.MCP_API_KEY || '90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5';

async function testConfluenceIntegration() {
  console.log('🧪 Testing Confluence Integration...\n');
  console.log(`📡 Connecting to MCP Server: ${MCP_SERVER_URL}\n`);

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing MCP server health...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log('✅ MCP server is healthy:', healthData);

    // Test 2: Establish SSE connection and test Confluence
    console.log('\n2️⃣  Connecting to Confluence via MCP...');
    
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${MCP_SERVER_URL}/mcp`, {
        headers: {
          'x-mcp-api-key': MCP_API_KEY
        }
      });
      let sessionId = null;
      let pendingRequests = new Map();

      eventSource.onopen = () => {
        console.log('✅ SSE connection established');
      };

      // Listen for message responses from the server
      eventSource.addEventListener('message', (event) => {
        try {
          const response = JSON.parse(event.data);
          
          // Handle responses by their request ID
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
          // Extract session ID from endpoint URL
          const endpointUrl = event.data;
          const match = endpointUrl.match(/sessionId=([^&]+)/);
          if (!match) {
            throw new Error('Could not extract session ID from endpoint');
          }
          
          sessionId = match[1];
          console.log('🔗 Session ID:', sessionId);

          // Helper function to send requests and wait for responses
          const sendRequest = async (method, params, id) => {
            return new Promise(async (resolveReq, rejectReq) => {
              const timeout = setTimeout(() => {
                pendingRequests.delete(id);
                rejectReq(new Error('Request timeout after 30 seconds'));
              }, 30000);

              pendingRequests.set(id, { 
                resolve: (result) => {
                  clearTimeout(timeout);
                  resolveReq(result);
                },
                reject: (error) => {
                  clearTimeout(timeout);
                  rejectReq(error);
                }
              });
              
              const request = {
                jsonrpc: '2.0',
                id,
                method: 'tools/call',
                params: {
                  name: method,
                  arguments: params
                }
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
                  clearTimeout(timeout);
                  pendingRequests.delete(id);
                  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
              } catch (error) {
                clearTimeout(timeout);
                pendingRequests.delete(id);
                rejectReq(error);
              }
            });
          };

          try {
            // Test 3: Test Confluence connection
            console.log('\n3️⃣  Testing Confluence connection...');
            const connectionResult = await sendRequest('confluence_test_connection', {}, 1);
            console.log('✅ Confluence connection test:', JSON.parse(connectionResult.content[0].text));

            // Test 4: List Confluence spaces
            console.log('\n4️⃣  Listing Confluence spaces...');
            const spacesResult = await sendRequest('confluence_list_spaces', {}, 2);
            const spaces = JSON.parse(spacesResult.content[0].text);
            console.log(`✅ Found ${spaces.spaces.length} Confluence space(s)`);
            if (spaces.spaces.length > 0) {
              console.log('   Spaces:');
              spaces.spaces.forEach(space => {
                console.log(`   - ${space.name} (${space.key})`);
              });
            }

            // Test 5: Show current config
            console.log('\n5️⃣  Checking current configuration...');
            const configResult = await sendRequest('confluence_show_config', {}, 3);
            const config = JSON.parse(configResult.content[0].text);
            console.log('✅ Configuration loaded:');
            console.log(`   URL: ${config.confluenceUrl || 'Not set'}`);
            console.log(`   Space: ${config.spaceKey || 'Not set (will use env default)'}`);

            // Test 6: Create a test page
            console.log('\n6️⃣  Creating test page...');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const testPageContent = `# MCP Test Page

This page was created automatically by the Confluence MCP server to test the integration.

## Test Details

- **Created**: ${new Date().toLocaleString('no-NO')}
- **Test ID**: ${timestamp}
- **MCP Server**: ${MCP_SERVER_URL}

## Features Tested

✅ MCP Server connection  
✅ Confluence API authentication  
✅ Space access  
✅ Page creation from Markdown  

## Markdown Features

### Code Block
\`\`\`javascript
console.log('Hello from MCP!');
\`\`\`

### List
- Item 1
- Item 2
- Item 3

### Table
| Feature | Status |
|---------|--------|
| Connection | ✅ Working |
| Authentication | ✅ Working |
| Page Creation | ✅ Working |

---

*This is a test page and can be safely deleted.*
`;

            const createResult = await sendRequest('confluence_create_page', {
              title: `MCP Test Page - ${timestamp}`,
              markdownContent: testPageContent
            }, 4);

            const pageInfo = JSON.parse(createResult.content[0].text);
            console.log('✅ Test page created successfully!');
            console.log(`   Title: ${pageInfo.page.title}`);
            console.log(`   Page ID: ${pageInfo.page.id}`);
            console.log(`   Space: ${pageInfo.page.spaceKey}`);
            console.log(`   URL: https://innovasjon-og-digitalisering.atlassian.net/wiki/spaces/${pageInfo.page.spaceKey}/pages/${pageInfo.page.id}`);

            eventSource.close();
            resolve({
              success: true,
              connectionTest: connectionResult,
              spaces: spaces.spaces,
              config,
              createdPage: pageInfo.page
            });

          } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            eventSource.close();
            reject(error);
          }
        } catch (error) {
          console.error('❌ Error during testing:', error);
          eventSource.close();
          reject(error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        eventSource.close();
        reject(error);
      };

      // Timeout after 60 seconds
      setTimeout(() => {
        console.log('⏰ Test timeout after 60 seconds');
        eventSource.close();
        reject(new Error('Test timeout'));
      }, 60000);
    });

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testConfluenceIntegration()
    .then((result) => {
      console.log('\n🎉 All integration tests passed!');
      console.log('\n📊 Summary:');
      console.log(`   - Confluence URL: https://innovasjon-og-digitalisering.atlassian.net`);
      console.log(`   - Spaces accessible: ${result.spaces.length}`);
      console.log(`   - Test page created: ${result.createdPage.title}`);
      console.log(`   - Page ID: ${result.createdPage.id}`);
      console.log('\n✨ Confluence MCP integration is working perfectly!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Integration tests failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testConfluenceIntegration };
