import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';

const DIAGRAM_CONVERTER_URL = process.env.DIAGRAM_CONVERTER_URL || 'http://diagram-converter:3000';

export interface ProcessedDiagram {
  filename: string;
  buffer: Buffer;
  originalCode: string;
  index: number;
}

export interface ProcessedMarkdown {
  markdown: string;
  diagrams: ProcessedDiagram[];
}

/**
 * DiagramProcessor extracts Mermaid diagrams from Markdown,
 * converts them to PNG using diagram-converter service,
 * and updates the Markdown to reference the PNG files.
 */
export class DiagramProcessor {
  
  /**
   * Process Markdown content containing Mermaid diagrams.
   * Extracts diagrams, converts to PNG, and updates Markdown references.
   * 
   * @param markdownContent - The original Markdown content
   * @param markdownPath - Optional path to the Markdown file for generating diagram names
   * @returns ProcessedMarkdown with updated content and PNG buffers
   */
  async processMarkdown(markdownContent: string, markdownPath?: string): Promise<ProcessedMarkdown> {
    const diagrams: ProcessedDiagram[] = [];
    let processedMarkdown = markdownContent;
    
    // Extract all Mermaid code blocks
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
    const matches = Array.from(markdownContent.matchAll(mermaidRegex));
    
    if (matches.length === 0) {
      // No diagrams to process
      return {
        markdown: markdownContent,
        diagrams: []
      };
    }

    console.log(`Found ${matches.length} Mermaid diagram(s) to process`);

    // Generate base name for diagrams
    const baseName = markdownPath 
      ? path.basename(markdownPath, path.extname(markdownPath))
      : 'diagram';

    // Process each Mermaid diagram
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const mermaidCode = match[1].trim();
      const filename = `${baseName}-diagram-${i + 1}.png`;

      try {
        console.log(`Converting Mermaid diagram ${i + 1}/${matches.length}: ${filename}`);
        
        // Convert Mermaid to PNG using diagram-converter service
        const pngBuffer = await this.convertMermaidToPng(mermaidCode);
        
        diagrams.push({
          filename,
          buffer: pngBuffer,
          originalCode: mermaidCode,
          index: i
        });

        console.log(`✅ Converted ${filename}: ${pngBuffer.length} bytes`);
      } catch (error: any) {
        console.error(`❌ Failed to convert diagram ${i + 1}:`, error.message);
        // Add placeholder for failed diagram
        diagrams.push({
          filename,
          buffer: Buffer.from(''),
          originalCode: mermaidCode,
          index: i
        });
      }
    }

    // Replace Mermaid code blocks with image references in Markdown
    let diagramIndex = 0;
    processedMarkdown = processedMarkdown.replace(mermaidRegex, (match) => {
      const diagram = diagrams[diagramIndex];
      diagramIndex++;
      
      if (diagram.buffer.length === 0) {
        // Conversion failed, keep original Mermaid code
        return match;
      }
      
      // Replace with Markdown image syntax
      return `![Diagram ${diagram.index + 1}](${diagram.filename})`;
    });

    return {
      markdown: processedMarkdown,
      diagrams: diagrams.filter(d => d.buffer.length > 0) // Only include successfully converted diagrams
    };
  }

  /**
   * Convert Mermaid code to PNG using the diagram-converter service
   * 
   * @param mermaidCode - The Mermaid diagram code
   * @returns Buffer containing the PNG image
   */
  private async convertMermaidToPng(mermaidCode: string): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${DIAGRAM_CONVERTER_URL}/convert/mermaid2png`,
        mermaidCode,
        {
          headers: {
            'Content-Type': 'text/plain'
          },
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout
        }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Diagram converter returned ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error(`Cannot reach diagram-converter at ${DIAGRAM_CONVERTER_URL}. Is the service running?`);
      } else {
        throw new Error(`Failed to convert diagram: ${error.message}`);
      }
    }
  }

  /**
   * Save Mermaid diagrams to assets folder and return updated Markdown
   * (Optional method for local file-based workflow)
   * 
   * @param markdownPath - Path to the Markdown file
   * @param diagrams - Array of processed diagrams
   * @returns Updated Markdown content with local file references
   */
  async saveDiagramsToAssets(markdownPath: string, diagrams: ProcessedDiagram[]): Promise<void> {
    const markdownDir = path.dirname(markdownPath);
    const assetsDir = path.join(markdownDir, 'assets');

    // Create assets directory if it doesn't exist
    await fs.mkdir(assetsDir, { recursive: true });

    // Save each diagram
    for (const diagram of diagrams) {
      // Save .mmd file
      const mmdPath = path.join(assetsDir, diagram.filename.replace('.png', '.mmd'));
      await fs.writeFile(mmdPath, diagram.originalCode, 'utf-8');
      console.log(`Saved Mermaid source: ${mmdPath}`);

      // Save .png file
      const pngPath = path.join(assetsDir, diagram.filename);
      await fs.writeFile(pngPath, diagram.buffer);
      console.log(`Saved PNG diagram: ${pngPath}`);
    }
  }

  /**
   * Check if diagram-converter service is available
   */
  async checkServiceAvailability(): Promise<boolean> {
    try {
      const response = await axios.get(`${DIAGRAM_CONVERTER_URL}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
