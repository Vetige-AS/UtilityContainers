import { startServer } from './server';
import { getPort } from './utils/config';

const port = getPort();

console.log('Starting Pandoc MCP server...');
console.log(`Port: ${port}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

startServer(port);
