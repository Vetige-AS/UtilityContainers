import { marked } from 'marked';
import { MermaidRenderer } from './mermaid-renderer';

export class MarkdownConverter {
  private mermaidRenderer: MermaidRenderer;
  
  constructor() {
    this.mermaidRenderer = new MermaidRenderer();
  }
  
  async convertToConfluence(markdown: string): Promise<string> {
    // Pre-process markdown for special elements
    let processedMarkdown = this.preprocessMarkdown(markdown);

    // Extract and process Mermaid diagrams
    const mermaidBlocks: string[] = [];
    processedMarkdown = processedMarkdown.replace(/```mermaid\n([\s\S]*?)\n```/g, (_match: string, code: string) => {
      mermaidBlocks.push(code.trim());
      return `{{mermaid-placeholder-${mermaidBlocks.length - 1}}}`;
    });

    // Configure marked for better parsing
    marked.setOptions({
      gfm: true,
      breaks: true
    });

    // Convert markdown to HTML
    let html = marked(processedMarkdown);

    // Convert HTML to Confluence storage format with professional styling
    let confluenceContent = this.htmlToConfluence(html);

    // Replace Mermaid placeholders with rendered images
    for (let i = 0; i < mermaidBlocks.length; i++) {
      try {
        await this.mermaidRenderer.renderDiagram(mermaidBlocks[i]);
        // Create a professional diagram layout with caption
        const diagramMacro = `
          <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">📊 Diagram ${i + 1}</ac:parameter>
            <ac:rich-text-body>
              <p style="text-align: center;">
                <ac:image ac:width="800">
                  <ri:attachment ri:filename="diagram-${i + 1}.png" />
                </ac:image>
              </p>
            </ac:rich-text-body>
          </ac:structured-macro>
        `;
        confluenceContent = confluenceContent.replace(`{{mermaid-placeholder-${i}}}`, diagramMacro);
      } catch (error) {
        console.error(`Failed to render Mermaid diagram ${i}:`, error);
        confluenceContent = confluenceContent.replace(`{{mermaid-placeholder-${i}}}`,
          `<ac:structured-macro ac:name="warning">
            <ac:rich-text-body><p>⚠️ Failed to render diagram</p></ac:rich-text-body>
          </ac:structured-macro>`);
      }
    }

    // Wrap content in a professional layout
    return this.wrapInProfessionalLayout(confluenceContent);
  }
  
  private htmlToConfluence(html: string): string {
    // This is a simplified conversion - a real implementation would be more comprehensive
    
    // Convert headings
    html = html.replace(/<h1>(.*?)<\/h1>/g, '<h1>$1</h1>');
    html = html.replace(/<h2>(.*?)<\/h2>/g, '<h2>$1</h2>');
    
    // Convert links
    html = html.replace(/<a href="(.*?)">(.*?)<\/a>/g, '<a href="$1">$2</a>');
    
    // Convert code blocks
    html = html.replace(/<pre><code class="language-(.*?)">([\s\S]*?)<\/code><\/pre>/g, 
      '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>');
    
    // Convert inline code
    html = html.replace(/<code>(.*?)<\/code>/g, '<code>$1</code>');
    
    // Convert lists with better spacing
    html = html.replace(/<ul>/g, '<ul style="margin: 12px 0; padding-left: 24px;">');
    html = html.replace(/<ol>/g, '<ol style="margin: 12px 0; padding-left: 24px;">');
    html = html.replace(/<li>/g, '<li style="margin: 4px 0;">');

    // Convert tables with professional styling
    html = html.replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">');
    html = html.replace(/<th>/g, '<th style="background-color: #F4F5F7; border: 1px solid #DFE1E6; padding: 12px; text-align: left; font-weight: 600;">');
    html = html.replace(/<td>/g, '<td style="border: 1px solid #DFE1E6; padding: 12px;">');

    // Convert blockquotes with better styling
    html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g,
      '<ac:structured-macro ac:name="quote"><ac:rich-text-body>$1</ac:rich-text-body></ac:structured-macro>');

    // Convert paragraphs with proper spacing
    html = html.replace(/<p>/g, '<p style="margin: 12px 0; line-height: 1.6;">');

    // Convert horizontal rules
    html = html.replace(/<hr\s*\/?>/g, '<hr style="border: none; border-top: 1px solid #DFE1E6; margin: 24px 0;">');

    return html;
  }

  private preprocessMarkdown(markdown: string): string {
    // Convert special markdown elements to custom markers for better processing

    // Convert info/warning/tip callouts
    markdown = markdown.replace(/^> \*\*Info:\*\* (.*$)/gm, '<div class="info-callout">$1</div>');
    markdown = markdown.replace(/^> \*\*Warning:\*\* (.*$)/gm, '<div class="warning-callout">$1</div>');
    markdown = markdown.replace(/^> \*\*Tip:\*\* (.*$)/gm, '<div class="tip-callout">$1</div>');

    // Convert table of contents marker
    markdown = markdown.replace(/\[TOC\]/g, '<div class="toc-marker"></div>');

    return markdown;
  }

  private wrapInProfessionalLayout(content: string): string {
    // Add table of contents if marker is present
    if (content.includes('<div class="toc-marker"></div>')) {
      content = content.replace('<div class="toc-marker"></div>',
        '<ac:structured-macro ac:name="toc"><ac:parameter ac:name="printable">true</ac:parameter></ac:structured-macro>');
    }

    // Wrap in a professional layout with proper spacing
    return `
      <ac:layout>
        <ac:layout-section ac:type="single">
          <ac:layout-cell>
            <div style="margin: 20px 0;">
              ${content}
            </div>
          </ac:layout-cell>
        </ac:layout-section>
      </ac:layout>
    `;
  }
}