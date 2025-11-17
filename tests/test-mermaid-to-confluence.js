#!/usr/bin/env node

/**
 * Test script to convert Mermaid diagrams to PNG and upload to Confluence
 * 
 * This test demonstrates the workflow:
 * 1. Create Mermaid diagram code
 * 2. Convert to PNG using diagram-converter service
 * 3. Upload PNG as attachment to Confluence page
 * 4. Reference the image in page content
 * 
 * IMPORTANT: Requires environment variables:
 * - CONFLUENCE_BASE_URL
 * - CONFLUENCE_USERNAME  
 * - CONFLUENCE_API_TOKEN
 * 
 * These can be set in .env file in the root directory.
 */

const EventSource = require('eventsource');
const fetch = require('node-fetch');
const FormData = require('form-data');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MCP_API_KEY = process.env.MCP_API_KEY || '90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5';
const DIAGRAM_CONVERTER_URL = process.env.DIAGRAM_CONVERTER_URL || 'http://localhost:3000';
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL;
const CONFLUENCE_USERNAME = process.env.CONFLUENCE_USERNAME;
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;

// Mermaid diagram to test
const MERMAID_CODE = `graph LR
    A[Mermaid Diagram] --> B[diagram-converter]
    B --> C[PNG Image]
    C --> D[Confluence API]
    D --> E[Confluence Page]
    style A fill:#e1f5ff
    style E fill:#c8e6c9`;

async function testMermaidToConfluence() {
  console.log('🧪 Testing Mermaid → PNG → Confluence Workflow...\n');

  // Validate required environment variables
  if (!CONFLUENCE_BASE_URL || !CONFLUENCE_USERNAME || !CONFLUENCE_API_TOKEN) {
    throw new Error(
      'Missing required environment variables. Please set:\n' +
      '  - CONFLUENCE_BASE_URL\n' +
      '  - CONFLUENCE_USERNAME\n' +
      '  - CONFLUENCE_API_TOKEN\n' +
      'These can be configured in the .env file in the root directory.'
    );
  }

  try {
    // Step 1: Test diagram-converter health
    console.log('1️⃣  Testing diagram-converter service...');
    const diagramHealth = await fetch(`${DIAGRAM_CONVERTER_URL}/health`);
    if (!diagramHealth.ok) {
      throw new Error(`Diagram converter health check failed: ${diagramHealth.status}`);
    }
    const diagramHealthData = await diagramHealth.json();
    console.log('✅ Diagram converter is ready:', diagramHealthData.status);

    // Step 2: Convert Mermaid to PNG
    console.log('\n2️⃣  Converting Mermaid diagram to PNG...');
    const convertResponse = await fetch(`${DIAGRAM_CONVERTER_URL}/convert/mermaid2png`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: MERMAID_CODE
    });

    if (!convertResponse.ok) {
      const error = await convertResponse.text();
      throw new Error(`Mermaid conversion failed: ${error}`);
    }

    const pngBuffer = await convertResponse.buffer();
    console.log(`✅ Converted to PNG: ${pngBuffer.length} bytes`);

    // Step 3: Connect to MCP server and create page
    console.log('\n3️⃣  Connecting to Confluence MCP...');
    
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${MCP_SERVER_URL}/mcp`, {
        headers: {
          'x-mcp-api-key': MCP_API_KEY
        }
      });
      
      let sessionId = null;
      let pendingRequests = new Map();

      eventSource.onopen = () => {
        console.log('✅ MCP connection established');
      };

      eventSource.addEventListener('message', (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.id && pendingRequests.has(response.id)) {
            const { resolve, reject } = pendingRequests.get(response.id);
            pendingRequests.delete(response.id);
            
            if (response.error) {
              reject(new Error(response.error.message || JSON.stringify(response.error)));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      eventSource.addEventListener('endpoint', async (event) => {
        try {
          const endpointUrl = event.data;
          const match = endpointUrl.match(/sessionId=([^&]+)/);
          if (!match) {
            throw new Error('Could not extract session ID');
          }
          
          sessionId = match[1];
          console.log('🔗 Session ID:', sessionId);

          const sendRequest = async (method, params, id) => {
            return new Promise(async (resolveReq, rejectReq) => {
              pendingRequests.set(id, { resolve: resolveReq, reject: rejectReq });
              
              const request = {
                jsonrpc: '2.0',
                id,
                method,
                params
              };

              try {
                const response = await fetch(`${MCP_SERVER_URL}/messages?sessionId=${sessionId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-mcp-api-key': MCP_API_KEY
                  },
                  body: JSON.stringify(request)
                });

                if (!response.ok) {
                  pendingRequests.delete(id);
                  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
              } catch (error) {
                pendingRequests.delete(id);
                rejectReq(error);
              }
            });
          };

          try {
            // Step 4: Create Confluence page first (without Mermaid code blocks to avoid rendering)
            console.log('\n4️⃣  Creating Confluence page...');
            
            const pageContent = `# Mermaid Diagram Test

This page demonstrates converting Mermaid diagrams to PNG and uploading to Confluence.

## Original Mermaid Code

The diagram code is shown below (not rendered as it's already converted to PNG):

\`\`\`text
${MERMAID_CODE}
\`\`\`

## Converted Diagram

The diagram will be attached as PNG and displayed below:

*(Image will be added in the next step)*
`;

            const createResult = await sendRequest('tools/call', {
              name: 'confluence_create_page',
              arguments: {
                title: `Mermaid to PNG Test - ${new Date().toISOString().split('T')[0]}`,
                markdownContent: pageContent
              }
            }, 1);

            const createData = JSON.parse(createResult.content[0].text);
            if (!createData.success) {
              throw new Error('Failed to create page: ' + JSON.stringify(createData));
            }

            const pageId = createData.page.id;
            const pageTitle = createData.page.title;
            const spaceKey = createData.page.spaceKey;
            
            console.log(`✅ Page created: ${pageTitle}`);
            console.log(`   Page ID: ${pageId}`);
            console.log(`   Space: ${spaceKey}`);

            // Step 5: Upload PNG as attachment
            console.log('\n5️⃣  Uploading PNG as attachment to Confluence...');
            
            const formData = new FormData();
            formData.append('file', pngBuffer, {
              filename: 'diagram.png',
              contentType: 'image/png'
            });

            const attachmentUrl = `${CONFLUENCE_BASE_URL}/rest/api/content/${pageId}/child/attachment`;
            const uploadResponse = await fetch(attachmentUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${CONFLUENCE_USERNAME}:${CONFLUENCE_API_TOKEN}`).toString('base64'),
                'X-Atlassian-Token': 'no-check',
                ...formData.getHeaders()
              },
              body: formData
            });

            if (!uploadResponse.ok) {
              const error = await uploadResponse.text();
              throw new Error(`Failed to upload attachment: ${uploadResponse.status} - ${error}`);
            }

            const attachmentData = await uploadResponse.json();
            const attachmentId = attachmentData.results[0].id;
            const attachmentTitle = attachmentData.results[0].title;
            
            console.log(`✅ Attachment uploaded: ${attachmentTitle}`);
            console.log(`   Attachment ID: ${attachmentId}`);

            // Step 6: Update page content to include the image using Confluence storage format
            console.log('\n6️⃣  Updating page to display the diagram...');

            // Use Confluence storage format (HTML + macros) directly to embed the image
            const updatedContent = `<h1>Mermaid Diagram Test</h1>
<p>This page demonstrates converting Mermaid diagrams to PNG and uploading to Confluence.</p>

<h2>Original Mermaid Code</h2>
<ac:structured-macro ac:name="code">
  <ac:plain-text-body><![CDATA[${MERMAID_CODE}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Converted Diagram</h2>
<p style="text-align: center;">
  <ac:image ac:width="600">
    <ri:attachment ri:filename="diagram.png" />
  </ac:image>
</p>

<h2>Workflow</h2>
<ul>
  <li>✅ Mermaid code defined</li>
  <li>✅ Converted to PNG using diagram-converter service</li>
  <li>✅ Page created in Confluence</li>
  <li>✅ PNG uploaded as attachment</li>
  <li>✅ Image displayed in page content</li>
</ul>

<p><strong>Success!</strong> The Mermaid diagram is now displayed as a PNG image in Confluence! 🎉</p>`;

            // Update page directly using Confluence API (not through MCP converter)
            const updateUrl = `${CONFLUENCE_BASE_URL}/rest/api/content/${pageId}`;
            const updateResponse = await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${CONFLUENCE_USERNAME}:${CONFLUENCE_API_TOKEN}`).toString('base64'),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                version: {
                  number: createData.page.version.number + 1
                },
                title: pageTitle,
                type: 'page',
                body: {
                  storage: {
                    value: updatedContent,
                    representation: 'storage'
                  }
                }
              })
            });

            if (!updateResponse.ok) {
              const error = await updateResponse.text();
              throw new Error(`Failed to update page: ${updateResponse.status} - ${error}`);
            }

            const updateData = await updateResponse.json();

            console.log(`✅ Page updated with diagram image`);

            const pageUrl = `${CONFLUENCE_BASE_URL}/spaces/${spaceKey}/pages/${pageId}`;
            console.log(`\n🌐 View page: ${pageUrl}`);

            eventSource.close();
            resolve({
              pageId,
              pageTitle,
              spaceKey,
              pageUrl,
              attachmentId,
              pngSize: pngBuffer.length
            });

          } catch (error) {
            console.error('❌ Error during workflow:', error);
            eventSource.close();
            reject(error);
          }
        } catch (error) {
          console.error('❌ Error processing endpoint:', error);
          eventSource.close();
          reject(error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        eventSource.close();
        reject(error);
      };

      setTimeout(() => {
        console.log('⏰ Test timeout after 30 seconds');
        eventSource.close();
        reject(new Error('Test timeout'));
      }, 30000);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testMermaidToConfluence()
    .then((result) => {
      console.log('\n🎉 Mermaid → PNG → Confluence workflow completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   - Page: ${result.pageTitle}`);
      console.log(`   - Page ID: ${result.pageId}`);
      console.log(`   - Space: ${result.spaceKey}`);
      console.log(`   - PNG size: ${result.pngSize} bytes`);
      console.log(`   - URL: ${result.pageUrl}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Workflow failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testMermaidToConfluence };
