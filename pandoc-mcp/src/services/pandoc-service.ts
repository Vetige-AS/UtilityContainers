import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { PandocConversionOptions, ConversionResult, PandocServiceConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export class PandocService {
  private config: PandocServiceConfig;

  constructor(config: PandocServiceConfig) {
    this.config = config;
  }

  /**
   * Validate path is within workspace directory
   */
  private validatePath(filePath: string): void {
    const resolved = path.resolve(filePath);
    const workspace = path.resolve(this.config.workspaceDir);
    
    if (!resolved.startsWith(workspace)) {
      throw new Error('Path traversal detected: Access denied outside workspace directory');
    }
  }

  /**
   * Convert document using Pandoc
   */
  async convert(
    input: string,
    options: PandocConversionOptions = {}
  ): Promise<ConversionResult> {
    try {
      const args = this.buildPandocArgs(options);
      
      // Use spawn for better security instead of shell execution
      const pandocProcess = spawn('pandoc', args);
      
      let stdout = '';
      let stderr = '';
      
      // Write input to stdin
      pandocProcess.stdin.write(input);
      pandocProcess.stdin.end();
      
      pandocProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pandocProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const exitCode = await new Promise<number>((resolve) => {
        pandocProcess.on('close', resolve);
      });

      if (exitCode !== 0 || (stderr && !stdout)) {
        throw new Error(stderr || 'Pandoc conversion failed');
      }

      return {
        success: true,
        output: stdout,
        format: options.outputFormat || this.config.defaultOutputFormat
      };
    } catch (error: any) {
      console.error('Pandoc conversion error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during conversion'
      };
    }
  }

  /**
   * Convert file using Pandoc
   */
  async convertFile(
    inputPath: string,
    outputPath: string,
    options: PandocConversionOptions = {}
  ): Promise<ConversionResult> {
    try {
      // Resolve paths relative to workspace
      const resolvedInputPath = path.isAbsolute(inputPath) 
        ? inputPath 
        : path.join(this.config.workspaceDir, inputPath);
      
      const resolvedOutputPath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(this.config.workspaceDir, outputPath);

      // Validate paths are within workspace (prevent path traversal)
      this.validatePath(resolvedInputPath);
      this.validatePath(resolvedOutputPath);

      // Verify input file exists
      await fs.access(resolvedInputPath);

      // Ensure output directory exists
      const outputDir = path.dirname(resolvedOutputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const args = this.buildPandocArgs(options);
      args.push('-o', resolvedOutputPath);
      args.push(resolvedInputPath);

      console.log('Executing Pandoc file conversion with args:', args);
      
      const pandocProcess = spawn('pandoc', args, {
        env: {
          ...process.env,
          PANDOC_DATA_DIR: this.config.dataDir
        }
      });
      
      let stderr = '';
      pandocProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const exitCode = await new Promise<number>((resolve) => {
        pandocProcess.on('close', resolve);
      });

      if (exitCode !== 0) {
        throw new Error(`Pandoc failed: ${stderr}`);
      }

      if (stderr) {
        console.warn('Pandoc warnings:', stderr);
      }

      // Read the output file
      const output = await fs.readFile(resolvedOutputPath, 'utf-8');

      return {
        success: true,
        output,
        format: options.outputFormat || this.inferOutputFormat(outputPath)
      };
    } catch (error: any) {
      console.error('Pandoc file conversion error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during file conversion'
      };
    }
  }

  /**
   * Get Pandoc version
   */
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('pandoc --version');
      return stdout.split('\n')[0];
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * List supported input formats
   */
  async listInputFormats(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('pandoc --list-input-formats');
      return stdout.trim().split('\n');
    } catch (error) {
      return [];
    }
  }

  /**
   * List supported output formats
   */
  async listOutputFormats(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('pandoc --list-output-formats');
      return stdout.trim().split('\n');
    } catch (error) {
      return [];
    }
  }

  /**
   * Build Pandoc command arguments
   */
  private buildPandocArgs(options: PandocConversionOptions): string[] {
    const args: string[] = [];

    // Input/output formats (sanitized - no user input in format names)
    if (options.inputFormat) {
      args.push('-f', this.sanitizeFormat(options.inputFormat));
    } else {
      args.push('-f', this.config.defaultInputFormat);
    }

    if (options.outputFormat) {
      args.push('-t', this.sanitizeFormat(options.outputFormat));
    } else {
      args.push('-t', this.config.defaultOutputFormat);
    }

    // Standalone document
    if (options.standalone) {
      args.push('--standalone');
    }

    // Table of contents
    if (options.toc) {
      args.push('--toc');
      if (options.tocDepth) {
        const depth = parseInt(String(options.tocDepth), 10);
        if (!isNaN(depth) && depth >= 1 && depth <= 6) {
          args.push(`--toc-depth=${depth}`);
        }
      }
    }

    // Number sections
    if (options.numberSections) {
      args.push('--number-sections');
    }

    // Syntax highlighting
    if (options.highlightStyle) {
      args.push(`--highlight-style=${this.sanitizeIdentifier(options.highlightStyle)}`);
    }

    // Template - validate path
    if (options.template) {
      const templatePath = path.resolve(this.config.workspaceDir, options.template);
      this.validatePath(templatePath);
      args.push('--template', templatePath);
    }

    // Variables - sanitize keys and values
    if (options.variables) {
      Object.entries(options.variables).forEach(([key, value]) => {
        const sanitizedKey = this.sanitizeIdentifier(key);
        const sanitizedValue = String(value).replace(/["']/g, ''); // Remove quotes
        args.push('-V', `${sanitizedKey}=${sanitizedValue}`);
      });
    }

    // Metadata - sanitize keys and values
    if (options.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        const sanitizedKey = this.sanitizeIdentifier(key);
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        const sanitizedValue = jsonValue.replace(/["']/g, ''); // Remove quotes
        args.push('-M', `${sanitizedKey}=${sanitizedValue}`);
      });
    }

    // Extra arguments - DO NOT include user-provided extra args for security
    // If needed, implement a whitelist of safe arguments
    if (options.extraArgs && options.extraArgs.length > 0) {
      console.warn('Extra arguments are disabled for security reasons');
    }

    return args;
  }

  /**
   * Sanitize format name to prevent injection
   */
  private sanitizeFormat(format: string): string {
    // Allow only alphanumeric, dash, underscore, and plus
    const sanitized = format.replace(/[^a-zA-Z0-9_+-]/g, '');
    if (sanitized !== format) {
      throw new Error(`Invalid format name: ${format}`);
    }
    return sanitized;
  }

  /**
   * Sanitize identifier (for variables, metadata keys, etc.)
   */
  private sanitizeIdentifier(identifier: string): string {
    // Allow only alphanumeric, dash, and underscore
    const sanitized = identifier.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized !== identifier) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return sanitized;
  }

  /**
   * Infer output format from file extension
   */
  private inferOutputFormat(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap: Record<string, string> = {
      '.html': 'html',
      '.pdf': 'pdf',
      '.docx': 'docx',
      '.odt': 'odt',
      '.epub': 'epub',
      '.tex': 'latex',
      '.md': 'markdown',
      '.rst': 'rst',
      '.txt': 'plain'
    };
    return formatMap[ext] || 'html';
  }
}
