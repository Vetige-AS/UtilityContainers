import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

// Middleware
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

async function convertSvgToPng(svgPath, pngPath, density = 300) {
  try {
    // Validate density parameter to prevent command injection
    const sanitizedDensity = parseInt(density, 10);
    if (isNaN(sanitizedDensity) || sanitizedDensity < 1 || sanitizedDensity > 1200) {
      throw new Error('Invalid density value. Must be a number between 1 and 1200.');
    }
    
    // Use spawn instead of exec for better security
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const process = spawn('convert', [
        '-density', sanitizedDensity.toString(),
        '-background', 'white',
        '-alpha', 'remove',
        svgPath,
        pngPath
      ]);
      
      let stderr = '';
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ImageMagick convert failed: ${stderr}`));
        } else {
          resolve();
        }
      });
      
      process.on('error', (err) => {
        reject(err);
      });
    });
    
    return pngPath;
  } catch (error) {
    console.error('SVG conversion error:', error);
    throw new Error(`Failed to convert SVG: ${error.message}`);
  }
}

async function convertMermaidToPng(mermaidContent, outputPath) {
  const inputPath = `/tmp/diagram-${Date.now()}-${Math.random().toString(36).substring(7)}.mmd`;
  
  try {
    await fs.writeFile(inputPath, mermaidContent, 'utf-8');
    
    // Use spawn instead of exec for better security
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const process = spawn('mmdc', [
        '-i', inputPath,
        '-o', outputPath,
        '-b', 'transparent'
      ]);
      
      let stderr = '';
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Mermaid CLI failed: ${stderr}`));
        } else {
          resolve();
        }
      });
      
      process.on('error', (err) => {
        reject(err);
      });
    });
    
    return outputPath;
  } catch (error) {
    console.error('Mermaid conversion error:', error);
    throw new Error(`Failed to convert Mermaid: ${error.message}`);
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'diagram-converter',
    version: '1.0.0',
    endpoints: {
      'POST /convert/svg2png': 'Convert SVG file to PNG',
      'POST /convert/mermaid2png': 'Convert Mermaid code to PNG',
      'POST /convert/mermaid-file': 'Convert Mermaid file to PNG',
      'GET /agent': 'Get VS Code agent definition'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Agent definition endpoint
app.get('/agent', (req, res) => {
  const agentDefinition = `---
description: Convert diagrams (SVG, Mermaid) to PNG format using the diagram-converter service
name: diagram-converter
argument-hint: Specify diagram files or directories to convert
tools: ['edit', 'search', 'usages']
target: vscode
---

# Diagram Conversion Agent

You are a specialized agent for converting diagrams to PNG format using the containerized diagram-converter service.

## Your Capabilities

You can:
- Convert SVG files to PNG
- Convert Mermaid (.mmd) files to PNG
- Process multiple diagrams in batch
- Update markdown files to reference converted PNG files
- Create and modify files as needed

## Available Services

### Diagram Converter Service
- **URL (from devcontainer)**: \`http://diagram-converter:3000\`
- **URL (from host)**: \`http://localhost:3000\`
- **Health check**: \`GET /health\`

### Endpoints:

1. **Convert SVG to PNG**
   \`\`\`bash
   curl -X POST http://diagram-converter:3000/convert/svg2png \\
     -F "file=@diagram.svg" \\
     -o output.png
   \`\`\`

2. **Convert Mermaid to PNG**
   \`\`\`bash
   curl -X POST http://diagram-converter:3000/convert/mermaid2png \\
     -H "Content-Type: text/plain" \\
     --data-binary "@diagram.mmd" \\
     -o output.png
   \`\`\`

3. **Convert Mermaid file**
   \`\`\`bash
   curl -X POST http://diagram-converter:3000/convert/mermaid-file \\
     -F "file=@diagram.mmd" \\
     -o output.png
   \`\`\`

## Workflow Instructions

### When asked to convert diagrams:

1. **Identify diagram files**
   - Search for \`.svg\` and \`.mmd\` files in the workspace
   - Check if the user specified particular files or directories
   - List all diagrams found before proceeding

2. **Convert each diagram**
   - Use the appropriate endpoint based on file type
   - Save PNG files with the same name but \`.png\` extension
   - Preserve directory structure
   - Report success/failure for each conversion

3. **Update markdown references (if requested)**
   - Find markdown files referencing the original diagrams
   - Replace \`.svg\` and \`.mmd\` references with \`.png\`
   - Preserve relative paths
   - Show which files were updated

### Error Handling

- If service is not available, suggest starting it with \`docker compose up -d diagram-converter\`
- If conversion fails, show the error and suggest checking the diagram syntax
- Verify files exist before attempting conversion

## Best Practices

1. **Always verify service availability first**
   \`\`\`bash
   curl http://diagram-converter:3000/health
   \`\`\`

2. **Process files in batches** - Don't convert files one at a time in separate requests

3. **Preserve file organization** - Keep PNG files alongside their source diagrams

4. **Update documentation** - If markdown files reference diagrams, update them automatically

5. **Report results clearly**
   - List all converted files
   - Show any failures
   - Provide next steps if needed

## Response Format

When completing a task:
1. Summarize what you found (number of diagrams)
2. Show conversion progress/results
3. List any markdown files updated
4. Provide paths to the new PNG files
5. Suggest next steps if relevant

Example response:
\`\`\`
✅ Converted 5 diagrams to PNG:
  - workspace/diagrams/architecture.svg → architecture.png
  - workspace/diagrams/flow.mmd → flow.png
  - workspace/diagrams/sequence.mmd → sequence.png
  - workspace/diagrams/component.svg → component.png
  - workspace/diagrams/er.mmd → er.png

📝 Updated 2 markdown files:
  - workspace/docs/README.md (3 references)
  - workspace/docs/architecture.md (2 references)

All PNG files saved to: workspace/diagrams/
\`\`\`

Remember: You have access to the diagram-converter service on the dev-network. Use it to provide fast, automated diagram conversions.`;

  res.setHeader('Content-Type', 'text/markdown');
  res.send(agentDefinition);
});

// Convert SVG to PNG
app.post('/convert/svg2png', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.png`;
  const density = parseInt(req.body.density) || 300;

  try {
    await convertSvgToPng(inputPath, outputPath, density);
    const pngBuffer = await fs.readFile(outputPath);

    // Cleanup
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    res.contentType('image/png');
    res.send(pngBuffer);
  } catch (error) {
    // Cleanup on error
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    console.error('SVG conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert Mermaid code to PNG
app.post('/convert/mermaid2png', async (req, res) => {
  const mermaidCode = req.body;

  if (!mermaidCode || typeof mermaidCode !== 'string') {
    return res.status(400).json({ error: 'No Mermaid code provided' });
  }

  const outputPath = `/tmp/diagram-${Date.now()}.png`;

  try {
    await convertMermaidToPng(mermaidCode, outputPath);
    const pngBuffer = await fs.readFile(outputPath);

    // Cleanup
    await fs.unlink(outputPath).catch(() => {});

    res.contentType('image/png');
    res.send(pngBuffer);
  } catch (error) {
    await fs.unlink(outputPath).catch(() => {});
    console.error('Mermaid conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert Mermaid file to PNG
app.post('/convert/mermaid-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.png`;

  try {
    const mermaidContent = await fs.readFile(inputPath, 'utf-8');
    await convertMermaidToPng(mermaidContent, outputPath);
    const pngBuffer = await fs.readFile(outputPath);

    // Cleanup
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    res.contentType('image/png');
    res.send(pngBuffer);
  } catch (error) {
    // Cleanup on error
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    console.error('Mermaid file conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Diagram Converter Service',
    version: '1.0.0',
    description: 'HTTP API for converting SVG and Mermaid diagrams to PNG',
    endpoints: {
      'GET /health': 'Health check',
      'POST /convert/svg2png': 'Convert SVG file to PNG (multipart/form-data)',
      'POST /convert/mermaid2png': 'Convert Mermaid code to PNG (text/plain)',
      'POST /convert/mermaid-file': 'Convert Mermaid file to PNG (multipart/form-data)'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Diagram Converter Service                                ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Status:  Running                                         ║`);
  console.log(`║  Port:    ${PORT}                                            ║`);
  console.log(`║  Health:  http://localhost:${PORT}/health                    ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
