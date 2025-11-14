export interface PandocConversionOptions {
  inputFormat?: string;
  outputFormat?: string;
  template?: string;
  variables?: Record<string, string>;
  metadata?: Record<string, any>;
  standalone?: boolean;
  toc?: boolean;
  tocDepth?: number;
  numberSections?: boolean;
  highlightStyle?: string;
  extraArgs?: string[];
}

export interface ConversionResult {
  success: boolean;
  output?: string;
  error?: string;
  format?: string;
  metadata?: Record<string, any>;
}

export interface PandocServiceConfig {
  dataDir: string;
  workspaceDir: string;
  defaultInputFormat: string;
  defaultOutputFormat: string;
}
