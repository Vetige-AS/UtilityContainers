#!/bin/bash

USAGE="Usage: $0 <markdown-file>

Process a markdown file and convert all referenced diagrams (SVG and Mermaid) to PNG.

Example:
  $0 workspace/docs/my-document.md

This will:
1. Find all diagram references (*.svg and *.mmd)
2. Convert them to PNG
3. Create a new markdown file with updated references (*_processed.md)
"

if [ $# -lt 1 ]; then
    echo "$USAGE"
    exit 1
fi

MARKDOWN_FILE=$1
SERVICE_URL="http://localhost:3000"

# Check if service is running
if ! curl -sf "$SERVICE_URL/health" > /dev/null 2>&1; then
    echo "❌ Error: Diagram converter service is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

# Check if input file exists
if [ ! -f "$MARKDOWN_FILE" ]; then
    echo "❌ Error: Markdown file not found: $MARKDOWN_FILE"
    exit 1
fi

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Processing Markdown Diagrams                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Input: $MARKDOWN_FILE"
echo ""

BASE_DIR=$(dirname "$MARKDOWN_FILE")
BASENAME=$(basename "$MARKDOWN_FILE" .md)
OUTPUT_FILE="${BASE_DIR}/${BASENAME}_processed.md"

# Copy original to processed
cp "$MARKDOWN_FILE" "$OUTPUT_FILE"

# Find all SVG references
echo "🔍 Finding diagram references..."
SVG_COUNT=$(grep -o '!\[.*\](.*\.svg)' "$MARKDOWN_FILE" | wc -l)
MERMAID_COUNT=$(grep -o '!\[.*\](.*\.mmd)' "$MARKDOWN_FILE" | wc -l)

echo "   Found $SVG_COUNT SVG references"
echo "   Found $MERMAID_COUNT Mermaid references"
echo ""

CONVERTED=0
FAILED=0

# Process SVG files
if [ $SVG_COUNT -gt 0 ]; then
    echo "📊 Converting SVG files..."
    grep -o '!\[.*\](.*\.svg)' "$MARKDOWN_FILE" | sed 's/!\[.*\](\(.*\.svg\))/\1/' | while read -r SVG_PATH; do
        FULL_SVG_PATH="${BASE_DIR}/${SVG_PATH}"
        PNG_PATH="${SVG_PATH%.svg}.png"
        FULL_PNG_PATH="${BASE_DIR}/${PNG_PATH}"
        
        if [ -f "$FULL_SVG_PATH" ]; then
            echo "  Converting: $SVG_PATH"
            if curl -X POST "$SERVICE_URL/convert/svg2png" \
                -F "file=@$FULL_SVG_PATH" \
                -o "$FULL_PNG_PATH" \
                -s -f; then
                
                # Update reference in processed file
                sed -i "s|${SVG_PATH}|${PNG_PATH}|g" "$OUTPUT_FILE"
                echo "    ✅ Success: $PNG_PATH"
                ((CONVERTED++))
            else
                echo "    ❌ Failed: $SVG_PATH"
                ((FAILED++))
            fi
        else
            echo "    ⚠️  Not found: $FULL_SVG_PATH"
        fi
    done
fi

# Process Mermaid files
if [ $MERMAID_COUNT -gt 0 ]; then
    echo ""
    echo "📊 Converting Mermaid files..."
    grep -o '!\[.*\](.*\.mmd)' "$MARKDOWN_FILE" | sed 's/!\[.*\](\(.*\.mmd\))/\1/' | while read -r MMD_PATH; do
        FULL_MMD_PATH="${BASE_DIR}/${MMD_PATH}"
        PNG_PATH="${MMD_PATH%.mmd}.png"
        FULL_PNG_PATH="${BASE_DIR}/${PNG_PATH}"
        
        if [ -f "$FULL_MMD_PATH" ]; then
            echo "  Converting: $MMD_PATH"
            if curl -X POST "$SERVICE_URL/convert/mermaid2png" \
                -H "Content-Type: text/plain" \
                --data-binary "@$FULL_MMD_PATH" \
                -o "$FULL_PNG_PATH" \
                -s -f; then
                
                # Update reference in processed file
                sed -i "s|${MMD_PATH}|${PNG_PATH}|g" "$OUTPUT_FILE"
                echo "    ✅ Success: $PNG_PATH"
                ((CONVERTED++))
            else
                echo "    ❌ Failed: $MMD_PATH"
                ((FAILED++))
            fi
        else
            echo "    ⚠️  Not found: $FULL_MMD_PATH"
        fi
    done
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Processing Complete                                      ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Converted: $CONVERTED diagrams                              "
if [ $FAILED -gt 0 ]; then
echo "║  Failed:    $FAILED diagrams                                 "
fi
echo "║  Output:    $OUTPUT_FILE                                  "
echo "╚═══════════════════════════════════════════════════════════╝"
