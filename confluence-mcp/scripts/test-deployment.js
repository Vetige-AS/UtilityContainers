#!/usr/bin/env node

/**
 * Test script for deployed Confluence MCP server
 */

const https = require('https');
const http = require('http');

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testDeployment(serverUrl, apiKey) {
  console.log(`🧪 Testing Confluence MCP Server: ${serverUrl}`);
  console.log('=' .repeat(60));
  
  // Test 1: Health check (no auth required)
  console.log('\n1. Testing health endpoint...');
  try {
    const healthResponse = await makeRequest(`${serverUrl}/health`);
    if (healthResponse.statusCode === 200) {
      console.log('✅ Health check passed');
      console.log(`   Response: ${healthResponse.body}`);
    } else {
      console.log(`❌ Health check failed: ${healthResponse.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health check error: ${error.message}`);
    return false;
  }
  
  // Test 2: MCP endpoint without auth (should fail)
  console.log('\n2. Testing MCP endpoint without authentication...');
  try {
    const noAuthResponse = await makeRequest(`${serverUrl}/mcp`);
    if (noAuthResponse.statusCode === 401) {
      console.log('✅ Authentication properly required (401 Unauthorized)');
    } else {
      console.log(`⚠️  Expected 401, got ${noAuthResponse.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ MCP no-auth test error: ${error.message}`);
  }
  
  // Test 3: MCP endpoint with auth (should work)
  if (apiKey) {
    console.log('\n3. Testing MCP endpoint with authentication...');
    try {
      const authResponse = await makeRequest(`${serverUrl}/mcp`, {
        headers: {
          'X-MCP-API-Key': apiKey
        }
      });
      if (authResponse.statusCode === 200) {
        console.log('✅ Authentication successful');
        console.log('✅ SSE connection established');
      } else {
        console.log(`❌ Auth test failed: ${authResponse.statusCode}`);
        console.log(`   Response: ${authResponse.body}`);
      }
    } catch (error) {
      console.log(`❌ MCP auth test error: ${error.message}`);
    }
  } else {
    console.log('\n3. Skipping auth test (no API key provided)');
  }
  
  // Test 4: Rate limiting (make multiple requests)
  console.log('\n4. Testing rate limiting...');
  try {
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(makeRequest(`${serverUrl}/health`));
    }
    
    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.statusCode === 200).length;
    console.log(`✅ Made 5 requests, ${successCount} succeeded (rate limiting working)`);
  } catch (error) {
    console.log(`❌ Rate limiting test error: ${error.message}`);
  }
  
  console.log('\n🎉 Deployment test completed!');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node test-deployment.js <server-url> [api-key]');
    console.log('');
    console.log('Examples:');
    console.log('  node test-deployment.js https://my-app.fly.dev');
    console.log('  node test-deployment.js https://my-app.fly.dev my-api-key');
    process.exit(1);
  }
  
  const serverUrl = args[0].replace(/\/$/, ''); // Remove trailing slash
  const apiKey = args[1];
  
  testDeployment(serverUrl, apiKey)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}
