#!/bin/bash

# Simple Lighthouse test script
# Usage: ./lighthouse-test.sh [url-path]
# Example: ./lighthouse-test.sh /en/about.html

set -e

# Default to English homepage if no path provided
URL_PATH=${1:-"/en/"}
BASE_URL="http://localhost:4173"
FULL_URL="${BASE_URL}${URL_PATH}"

echo "🏗️  Building project..."
npm run build > /dev/null

echo "🚀 Starting preview server..."
npm run preview &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
npx wait-on $BASE_URL

echo "🔍 Running Lighthouse on: $FULL_URL"
npx lighthouse $FULL_URL \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=html \
  --output-path=./lighthouse-report.html \
  --view

echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

echo "✅ Lighthouse test complete!"
echo "📊 Report saved to: lighthouse-report.html"
