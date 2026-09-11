#!/bin/bash
# Test Gemini API with curl

if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY environment variable is not set"
  echo "Please set it first: export GEMINI_API_KEY=your_key"
  exit 1
fi

echo "Testing Gemini API with curl..."
echo ""

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Explain how AI works in a few words"
          }
        ]
      }
    ]
  }' | jq '.'

echo ""
echo "Test completed!"
