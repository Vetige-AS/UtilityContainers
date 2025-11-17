#!/usr/bin/env node

/**
 * Test script to verify MCP server is delivering the correct tools
 */

const EventSource = require('eventsource');
const fetch = require('node-fetch');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MCP_API_KEY = process.env.MCP_API_KEY || '90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5';

async function testMCPTools() {
  console.log('🧪 Testing MCP Server Tool Discovery...\n');
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

    // Test 2: Establish SSE connection and list tools
    console.log('\n2️⃣  Establishing SSE connection and discovering tools...');
    
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
          console.log('📨 Received message:', response);
          
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
          // Extract session ID from endpoint URL: /messages?sessionId=xxx
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

                // For SSE, the POST just accepts the message
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

          // Test 3: List available tools
          console.log('\n3️⃣  Requesting list of available tools...');
          
          try {
            const result = await sendRequest('tools/list', {}, 1);
            
            if (result && result.tools) {
              console.log('\n📋 Available Tools:');
              console.log('==================');
              result.tools.forEach((tool, index) => {
                console.log(`\n${index + 1}. ${tool.name}`);
                console.log(`   Description: ${tool.description}`);
                if (tool.inputSchema && tool.inputSchema.properties) {
                  console.log(`   Parameters: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
                }
              });
              
              console.log(`\n✅ Total tools available: ${result.tools.length}`);
              
              eventSource.close();
              resolve(result.tools);
            } else {
              throw new Error('No tools found in response');
            }
          } catch (error) {
            console.error('❌ Error requesting tools:', error);
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

      // Timeout after 15 seconds
      setTimeout(() => {
        console.log('⏰ Test timeout after 15 seconds');
        eventSource.close();
        reject(new Error('Test timeout'));
      }, 15000);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testMCPTools()
    .then((tools) => {
      console.log('\n🎉 All tests passed!');
      console.log(`\n📊 Summary: Found ${tools.length} tools exposed by the MCP server`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testMCPTools };
