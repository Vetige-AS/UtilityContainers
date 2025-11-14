import { exec } from 'child_process';
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
   * Convert document using Pandoc
   */
  async convert(
    input: string,
    options: PandocConversionOptions = {}
  ): Promise<ConversionResult> {
    try {
      const args = this.buildPandocArgs(options);
      
      // Build the complete command
      const command = `echo ${this.escapeShellArg(input)} | pandoc ${args.join(' ')}`;
      
      console.log('Executing Pandoc command:', command);
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: {
          ...process.env,
          PANDOC_DATA_DIR: this.config.dataDir
        }
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
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

      // Verify input file exists
      await fs.access(resolvedInputPath);

      // Ensure output directory exists
      const outputDir = path.dirname(resolvedOutputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const args = this.buildPandocArgs(options);
      args.push(`-o "${resolvedOutputPath}"`);
      args.push(`"${resolvedInputPath}"`);

      const command = `pandoc ${args.join(' ')}`;
      
      console.log('Executing Pandoc file conversion:', command);
      
      const { stderr } = await execAsync(command, {
        env: {
          ...process.env,
          PANDOC_DATA_DIR: this.config.dataDir
        }
      });

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

    // Input/output formats
    if (options.inputFormat) {
      args.push(`-f ${options.inputFormat}`);
    } else {
      args.push(`-f ${this.config.defaultInputFormat}`);
    }

    if (options.outputFormat) {
      args.push(`-t ${options.outputFormat}`);
    } else {
      args.push(`-t ${this.config.defaultOutputFormat}`);
    }

    // Standalone document
    if (options.standalone) {
      args.push('--standalone');
    }

    // Table of contents
    if (options.toc) {
      args.push('--toc');
      if (options.tocDepth) {
        args.push(`--toc-depth=${options.tocDepth}`);
      }
    }

    // Number sections
    if (options.numberSections) {
      args.push('--number-sections');
    }

    // Syntax highlighting
    if (options.highlightStyle) {
      args.push(`--highlight-style=${options.highlightStyle}`);
    }

    // Template
    if (options.template) {
      args.push(`--template="${options.template}"`);
    }

    // Variables
    if (options.variables) {
      Object.entries(options.variables).forEach(([key, value]) => {
        args.push(`-V ${key}="${value}"`);
      });
    }

    // Metadata
    if (options.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        args.push(`-M ${key}="${jsonValue}"`);
      });
    }

    // Extra arguments
    if (options.extraArgs && options.extraArgs.length > 0) {
      args.push(...options.extraArgs);
    }

    return args;
  }

  /**
   * Escape shell argument
   */
  private escapeShellArg(arg: string): string {
    return `'${arg.replace(/'/g, "'\\''")}'`;
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
