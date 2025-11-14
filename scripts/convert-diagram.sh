#!/bin/bash

USAGE="Usage: $0 [svg|mermaid] <input-file> <output-file>

Examples:
  $0 svg workspace/diagrams/architecture.svg workspace/diagrams/architecture.png
  $0 mermaid workspace/diagrams/flow.mmd workspace/diagrams/flow.png
"

if [ $# -lt 3 ]; then
    echo "$USAGE"
    exit 1
fi

TYPE=$1
INPUT=$2
OUTPUT=$3
SERVICE_URL="http://localhost:3000"

# Check if service is running
if ! curl -sf "$SERVICE_URL/health" > /dev/null 2>&1; then
    echo "❌ Error: Diagram converter service is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

# Check if input file exists
if [ ! -f "$INPUT" ]; then
    echo "❌ Error: Input file not found: $INPUT"
    exit 1
fi

# Create output directory if needed
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "Converting $INPUT -> $OUTPUT"

case $TYPE in
    svg)
        echo "📊 Converting SVG to PNG..."
        HTTP_CODE=$(curl -X POST "$SERVICE_URL/convert/svg2png" \
            -F "file=@$INPUT" \
            -F "density=300" \
            -o "$OUTPUT" \
            -w "%{http_code}" \
            -s)
        
        if [ "$HTTP_CODE" == "200" ]; then
            echo "✅ Conversion successful!"
            echo "   Output: $OUTPUT"
            ls -lh "$OUTPUT"
        else
            echo "❌ Conversion failed (HTTP $HTTP_CODE)"
            cat "$OUTPUT" 2>/dev/null
            rm -f "$OUTPUT"
            exit 1
        fi
        ;;
    
    mermaid)
        echo "📊 Converting Mermaid to PNG..."
        HTTP_CODE=$(curl -X POST "$SERVICE_URL/convert/mermaid2png" \
            -H "Content-Type: text/plain" \
            --data-binary "@$INPUT" \
            -o "$OUTPUT" \
            -w "%{http_code}" \
            -s)
        
        if [ "$HTTP_CODE" == "200" ]; then
            echo "✅ Conversion successful!"
            echo "   Output: $OUTPUT"
            ls -lh "$OUTPUT"
        else
            echo "❌ Conversion failed (HTTP $HTTP_CODE)"
            cat "$OUTPUT" 2>/dev/null
            rm -f "$OUTPUT"
            exit 1
        fi
        ;;
    
    *)
        echo "❌ Invalid type: $TYPE"
        echo "   Valid types: svg, mermaid"
        echo ""
        echo "$USAGE"
        exit 1
        ;;
esac

echo ""
echo "✨ Done!"
