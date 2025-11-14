#!/usr/bin/env node

/**
 * Simple test script to verify MCP tools work correctly
 * This simulates how an AI assistant would interact with our MCP server
 */

const EventSource = require('eventsource');
const fetch = require('node-fetch');

const MCP_SERVER_URL = 'http://localhost:3001';

async function testMCPConnection() {
  console.log('🧪 Testing Confluence MCP Server...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test 2: SSE connection
    console.log('\n2. Testing SSE connection...');
    
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${MCP_SERVER_URL}/mcp`);
      let sessionId = null;

      eventSource.onopen = () => {
        console.log('✅ SSE connection established');
      };

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received:', data);

          if (data.type === 'endpoint') {
            sessionId = data.sessionId;
            console.log('🔗 Session ID:', sessionId);

            // Test 3: Send a tool request
            console.log('\n3. Testing confluence_list_spaces tool...');
            
            const toolRequest = {
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: {
                name: 'confluence_list_spaces',
                arguments: {}
              }
            };

            const response = await fetch(`${MCP_SERVER_URL}/messages?sessionId=${sessionId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(toolRequest)
            });

            const result = await response.json();
            console.log('🛠️ Tool response:', JSON.stringify(result, null, 2));

            eventSource.close();
            resolve(result);
          }
        } catch (error) {
          console.error('❌ Error processing message:', error);
          eventSource.close();
          reject(error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ SSE error:', error);
        eventSource.close();
        reject(error);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        console.log('⏰ Test timeout');
        eventSource.close();
        reject(new Error('Test timeout'));
      }, 10000);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testMCPConnection()
    .then(() => {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testMCPConnection };
