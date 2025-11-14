// Confluence API Types
export interface Space {
  id: string;
  key: string;
  name: string;
  description?: string;
}

export interface Page {
  id: string;
  title: string;
  spaceKey: string;
  version: {
    number: number;
  };
  body?: {
    storage: {
      value: string;
      representation: string;
    };
  };
}

export interface PageMapping {
  markdownPath: string;
  pageId: string;
  spaceKey: string;
  title: string;
  lastUpdated: string;
}

// Configuration Types
export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
}

// Tool Response Types
export interface ToolResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

export interface ListSpacesResponse extends ToolResponse {
  spaces?: Array<{
    key: string;
    name: string;
  }>;
}

export interface ListPagesResponse extends ToolResponse {
  pages?: Array<{
    id: string;
    title: string;
    spaceKey: string;
    version: number;
  }>;
}

export interface PageOperationResponse extends ToolResponse {
  page?: {
    id: string;
    title: string;
    spaceKey: string;
    version: {
      number: number;
    };
  };
}

// Mermaid Types
export interface MermaidRenderOptions {
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  backgroundColor?: string;
  width?: number;
  height?: number;
}

// Server Types
export interface ServerConfig {
  port: number;
  apiKey?: string;
  corsOrigins?: string[];
}

// SSE Types
export interface SSEMessage {
  type: 'progress' | 'complete' | 'error';
  data: any;
  timestamp: string;
}

export interface ProgressUpdate {
  step: string;
  progress: number;
  message: string;
}
