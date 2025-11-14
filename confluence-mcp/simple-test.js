#!/usr/bin/env node

/**
 * Simple HTTP test for the MCP server
 */

const fetch = require('node-fetch');

const MCP_SERVER_URL = 'http://localhost:3001';

async function testServer() {
  console.log('🧪 Testing Confluence MCP Server...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test 2: Test SSE endpoint (just check if it responds)
    console.log('\n2. Testing SSE endpoint...');
    const sseResponse = await fetch(`${MCP_SERVER_URL}/mcp`);
    console.log('✅ SSE endpoint status:', sseResponse.status);
    console.log('✅ SSE headers:', Object.fromEntries(sseResponse.headers.entries()));

    console.log('\n🎉 Basic server tests passed!');
    console.log('\n📝 Next steps:');
    console.log('- Set up your Confluence credentials in .env file');
    console.log('- Test with a real MCP client like Claude Desktop');
    console.log('- Try creating a page from markdown content');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testServer()
    .then(() => {
      console.log('\n✨ All tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testServer };
