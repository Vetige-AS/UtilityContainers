import dotenv from 'dotenv';
import { PandocServiceConfig } from '../types';

dotenv.config();

export function loadConfig(): PandocServiceConfig {
  return {
    dataDir: process.env.PANDOC_DATA_DIR || '/data',
    workspaceDir: process.env.WORKSPACE_DIR || '/workspace',
    defaultInputFormat: process.env.DEFAULT_INPUT_FORMAT || 'markdown',
    defaultOutputFormat: process.env.DEFAULT_OUTPUT_FORMAT || 'html'
  };
}

export function getPort(): number {
  return parseInt(process.env.PORT || '3002', 10);
}

export function getMcpApiKey(): string | undefined {
  return process.env.MCP_API_KEY;
}
