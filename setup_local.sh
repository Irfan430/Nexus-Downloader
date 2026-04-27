#!/bin/bash

echo "🚀 Starting Nexus Downloader Local Setup..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first."
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install it first."
    exit 1
fi

echo "📦 Installing Node.js dependencies..."
npm install

echo "🐍 Installing Python dependencies (yt-dlp, gallery-dl)..."
pip3 install yt-dlp gallery-dl

echo "✅ Setup complete!"
echo "▶️ To start the server, run: npm start"
echo "🌐 Dashboard will be available at: http://localhost:3000/dashboard"
