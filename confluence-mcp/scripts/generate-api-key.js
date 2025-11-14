#!/usr/bin/env node

/**
 * Generate a secure API key for the MCP server
 */

const crypto = require('crypto');

function generateSecureApiKey() {
  // Generate a 256-bit (32 byte) random key
  const key = crypto.randomBytes(32).toString('base64url');
  return key;
}

function main() {
  console.log('🔐 Generating secure MCP API key...\n');
  
  const apiKey = generateSecureApiKey();
  
  console.log('✅ Generated secure API key:');
  console.log(`MCP_API_KEY=${apiKey}\n`);
  
  console.log('📋 Copy this key and use it in your deployment:\n');
  console.log('For Fly.io deployment:');
  console.log(`fly secrets set MCP_API_KEY="${apiKey}"\n`);
  
  console.log('For local development (.env file):');
  console.log(`MCP_API_KEY=${apiKey}\n`);
  
  console.log('⚠️  IMPORTANT: Store this key securely and never commit it to version control!');
  console.log('   This key provides access to your Confluence MCP server.');
}

if (require.main === module) {
  main();
}

module.exports = { generateSecureApiKey };
