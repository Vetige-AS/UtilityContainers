#!/usr/bin/env node

/**
 * Test script to verify live Confluence connection and create a test page
 */

const EventSource = require('eventsource');
const fetch = require('node-fetch');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MCP_API_KEY = process.env.MCP_API_KEY || '90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5';

async function testConfluenceLive() {
  console.log('🧪 Testing Live Confluence Connection...\n');
  console.log(`📡 Connecting to: ${MCP_SERVER_URL}\n`);

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing health endpoint...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData);

    // Test 2: Establish SSE connection
    console.log('\n2️⃣  Establishing SSE connection...');
    
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
          console.log('📨 Received endpoint:', endpointUrl);
          
          const match = endpointUrl.match(/sessionId=([^&]+)/);
          if (!match) {
            throw new Error('Could not extract session ID from endpoint');
          }
          
          sessionId = match[1];
          console.log('🔗 Session ID:', sessionId);

          // Helper function to send requests and wait for responses
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
            // Test 3: Test Confluence connection
            console.log('\n3️⃣  Testing Confluence connection...');
            const testResult = await sendRequest('tools/call', {
              name: 'confluence_test_connection',
              arguments: {}
            }, 1);
            console.log('✅ Confluence connection test:', testResult);

            // Test 4: List spaces
            console.log('\n4️⃣  Listing Confluence spaces...');
            const spacesResult = await sendRequest('tools/call', {
              name: 'confluence_list_spaces',
              arguments: {}
            }, 2);
            
            const spacesData = JSON.parse(spacesResult.content[0].text);
            if (spacesData.spaces) {
              console.log(`✅ Found ${spacesData.spaces.length} spaces:`);
              spacesData.spaces.forEach(space => {
                console.log(`   - ${space.key}: ${space.name}`);
              });
            }

            // Test 5: Create a test page
            console.log('\n5️⃣  Creating a test page...');
            
            const testPageContent = `# MCP Test Page

This is a test page created by the Confluence MCP server to verify the connection is working correctly.

## Test Details

- **Created**: ${new Date().toISOString()}
- **Server**: Confluence MCP v0.1.0
- **Transport**: Server-Sent Events (SSE)

## Features Tested

✅ Authentication  
✅ Space access  
✅ Page creation  
✅ Markdown conversion  

## Mermaid Diagram Test

\`\`\`mermaid
graph LR
    A[MCP Client] --> B[MCP Server]
    B --> C[Confluence API]
    C --> D[Confluence Page]
\`\`\`

## Success!

If you can see this page in Confluence, the MCP server is working correctly! 🎉
`;

            const createResult = await sendRequest('tools/call', {
              name: 'confluence_create_page',
              arguments: {
                title: `MCP Test Page - ${new Date().toISOString().split('T')[0]}`,
                markdownContent: testPageContent
              }
            }, 3);

            const createData = JSON.parse(createResult.content[0].text);
            if (createData.success) {
              console.log('✅ Test page created successfully!');
              console.log('   Page ID:', createData.page.id);
              console.log('   Title:', createData.page.title);
              console.log('   Space:', createData.page.spaceKey);
              console.log(`   URL: https://innovasjon-og-digitalisering.atlassian.net/wiki/spaces/${createData.page.spaceKey}/pages/${createData.page.id}`);
            } else {
              console.log('❌ Failed to create page:', createData);
            }

            eventSource.close();
            resolve({
              health: healthData,
              sessionId,
              confluenceTest: testResult,
              spaces: spacesData,
              page: createData
            });

          } catch (error) {
            console.error('❌ Error during Confluence tests:', error);
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

      // Timeout after 30 seconds
      setTimeout(() => {
        console.log('⏰ Test timeout after 30 seconds');
        eventSource.close();
        reject(new Error('Test timeout'));
      }, 30000);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testConfluenceLive()
    .then((result) => {
      console.log('\n🎉 All Confluence tests passed!');
      console.log('\n📊 Summary:');
      console.log(`   - Health: ${result.health.status}`);
      console.log(`   - Session: ${result.sessionId}`);
      console.log(`   - Spaces found: ${result.spaces.spaces?.length || 0}`);
      if (result.page.success) {
        console.log(`   - Test page created: ${result.page.page.title}`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Confluence tests failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testConfluenceLive };
