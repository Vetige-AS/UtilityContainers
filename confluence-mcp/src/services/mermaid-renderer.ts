import puppeteer from 'puppeteer';

export interface MermaidRenderOptions {
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  backgroundColor?: string;
  width?: number;
  height?: number;
}

export class MermaidRenderer {
  async renderDiagram(mermaidCode: string, options: MermaidRenderOptions = {}): Promise<string> {
    const {
      theme = 'default',
      backgroundColor = 'white',
      width = 1200,
      height = 800
    } = options;

    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      headless: true
    });

    try {
      const page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width, height });

      // Set up the page with Mermaid and professional styling
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.0/dist/mermaid.min.js"></script>
            <script>
              mermaid.initialize({
                startOnLoad: true,
                theme: '${theme}',
                securityLevel: 'loose',
                themeVariables: {
                  primaryColor: '#0052CC',
                  primaryTextColor: '#172B4D',
                  primaryBorderColor: '#DFE1E6',
                  lineColor: '#42526E',
                  secondaryColor: '#F4F5F7',
                  tertiaryColor: '#FFFFFF'
                },
                flowchart: {
                  useMaxWidth: true,
                  htmlLabels: true,
                  curve: 'basis'
                },
                sequence: {
                  diagramMarginX: 50,
                  diagramMarginY: 10,
                  actorMargin: 50,
                  width: 150,
                  height: 65,
                  boxMargin: 10,
                  boxTextMargin: 5,
                  noteMargin: 10,
                  messageMargin: 35
                }
              });
            </script>
            <style>
              body {
                background: ${backgroundColor};
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              .mermaid {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 200px;
                padding: 20px;
              }
              .mermaid svg {
                max-width: 100%;
                height: auto;
                filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1));
              }
            </style>
          </head>
          <body>
            <div class="mermaid">
              ${mermaidCode}
            </div>
          </body>
        </html>
      `);

      // Wait for Mermaid to render with timeout
      try {
        await page.waitForSelector('.mermaid svg', { timeout: 10000 });
      } catch (error) {
        throw new Error(`Mermaid diagram failed to render: ${error}`);
      }

      // Get the SVG element
      const svgElement = await page.$('.mermaid svg');
      if (!svgElement) {
        throw new Error('Failed to find rendered Mermaid diagram');
      }

      // Take a high-quality screenshot of the SVG
      const imageBuffer = await svgElement.screenshot({
        type: 'png',
        omitBackground: backgroundColor === 'transparent',
        clip: await svgElement.boundingBox() || undefined
      });

      // Convert to base64 for embedding
      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } finally {
      await browser.close();
    }
  }

  async renderDiagramToFile(mermaidCode: string, outputPath: string, options: MermaidRenderOptions = {}): Promise<void> {
    const base64Data = await this.renderDiagram(mermaidCode, options);
    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');

    const fs = await import('fs');
    fs.writeFileSync(outputPath, buffer);
  }
}