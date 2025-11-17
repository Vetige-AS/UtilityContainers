#!/usr/bin/env node
const crypto = require('crypto');

const apiKey = crypto.randomBytes(32).toString('hex');
console.log('Generated MCP API Key:');
console.log(apiKey);
console.log('\nAdd this to your .env file:');
console.log(`MCP_API_KEY=${apiKey}`);
