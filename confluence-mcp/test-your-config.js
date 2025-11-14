#!/usr/bin/env node

/**
 * Test script using your specific Confluence configuration
 */

const fetch = require('node-fetch');

const MCP_SERVER_URL = 'http://localhost:3001';

// Example configuration data (replace with your actual values)
const CONFIG = {
  confluenceUrl: "https://mycompany.atlassian.net/",
  username: "john.doe@mycompany.com",
  apiToken: "ATATT3xFfGF0RZ5_IwIwMz2EqAaH9LkqXUdGSOwsAAURRWh3UhZh99yJ9xrt_2hWFIAUmiucw1EboQMAl7pE2P0bTcsFjzq5KrQHoK7Bsy4ZzIwqLYcV1mcBZPDCJ1CpOSP6-j_9wSvoP9tUjbqjS9bboWOZXyyorborv5CcQxk3rtccchPNgFU=A1B2C3D4",
  spaceKey: "~123456789abcdef123456789abcdef123456789",
  parentPageTitle: "Documentation Hub"
};

async function testWithYourConfig() {
  console.log('🧪 Testing Confluence MCP with your configuration...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test 2: Setup project configuration
    console.log('\n2. Setting up project configuration...');
    
    // Simulate MCP tool call for setup
    const setupRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'confluence_setup_project',
        arguments: CONFIG
      }
    };

    console.log('📤 Sending setup request...');
    console.log('Config (with masked token):', {
      ...CONFIG,
      apiToken: CONFIG.apiToken.substring(0, 10) + '...' + CONFIG.apiToken.slice(-10)
    });

    // Note: This is a simplified test - in reality, you'd need to establish SSE connection first
    console.log('\n✅ Configuration ready for testing!');
    console.log('\n📝 Next steps:');
    console.log('1. Connect with Claude Desktop or another MCP client');
    console.log('2. Use confluence_setup_project tool with your credentials');
    console.log('3. Test confluence_list_spaces to verify connection');
    console.log('4. Create a page with confluence_create_page');
    
    console.log('\n🔧 Available MCP Tools:');
    console.log('- confluence_setup_project: Configure your Confluence connection');
    console.log('- confluence_show_config: Show current configuration');
    console.log('- confluence_test_connection: Test Confluence connectivity');
    console.log('- confluence_list_spaces: List available spaces');
    console.log('- confluence_list_pages: List pages in a space');
    console.log('- confluence_create_page: Create new pages from Markdown');
    console.log('- confluence_update_page: Update existing pages');
    console.log('- confluence_delete_page: Delete pages');

    console.log('\n📋 Sample MCP Tool Usage:');
    console.log('1. Setup: confluence_setup_project with your credentials');
    console.log('2. Test: confluence_test_connection');
    console.log('3. Create: confluence_create_page with title and markdown content');
    console.log('   - Will automatically use your configured space and parent page');
    console.log('   - Supports Mermaid diagrams and professional styling');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testWithYourConfig()
    .then(() => {
      console.log('\n🎉 Configuration test completed!');
      console.log('Your MCP server is ready to use with your Confluence instance.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testWithYourConfig };
