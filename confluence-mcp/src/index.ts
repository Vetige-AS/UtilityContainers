import dotenv from 'dotenv';
import { startServer } from './server';

// Load environment variables
dotenv.config();

// Start the MCP server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
startServer(port);