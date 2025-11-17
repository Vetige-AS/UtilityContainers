import fs from 'fs';
import path from 'path';

interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey?: string;
}

let confluenceConfig: ConfluenceConfig | null = null;

export function loadConfig(): void {
  // Load from environment variables (optional - can be empty for generic mode)
  confluenceConfig = {
    baseUrl: process.env.CONFLUENCE_BASE_URL || '',
    username: process.env.CONFLUENCE_USERNAME || '',
    apiToken: process.env.CONFLUENCE_API_TOKEN || '',
    spaceKey: process.env.CONFLUENCE_SPACE_KEY || ''
  };
  
  const isConfigured = !!(confluenceConfig.baseUrl && confluenceConfig.username && confluenceConfig.apiToken);
  if (isConfigured) {
    console.log(`Confluence configuration loaded (pre-configured mode: ${confluenceConfig.baseUrl})`);
    if (confluenceConfig.spaceKey) {
      console.log(`  Default space key: ${confluenceConfig.spaceKey}`);
    }
  } else {
    console.log('Confluence configuration loaded (generic mode: credentials can be provided per-request)');
  }
}

export function getConfig(): ConfluenceConfig {
  if (!confluenceConfig) {
    loadConfig();
  }
  
  // Allow empty config for generic mode - credentials will be provided per-request
  return confluenceConfig || { baseUrl: '', username: '', apiToken: '', spaceKey: '' };
}

export function updateConfig(config: Partial<ConfluenceConfig>): void {
  if (!confluenceConfig) {
    loadConfig();
  }
  confluenceConfig = { ...getConfig(), ...config };
}

export function validateConfig(config: Partial<ConfluenceConfig>): boolean {
  return !!(config.baseUrl && config.username && config.apiToken);
}

export function getDefaultSpaceKey(): string | undefined {
  const config = getConfig();
  return config.spaceKey || undefined;
}