# 🚀 Nexus Downloader

Nexus Downloader is a high-performance, production-ready media downloader API built with Node.js and Express. It utilizes a hybrid engine chain to ensure maximum compatibility and speed across 1000+ platforms including YouTube, TikTok, Instagram, CapCut, Reddit, and more.

## ✨ Features

- **Hybrid Engine Chain**: Automatically switches between Cobalt, `yt-dlp`, `gallery-dl`, and Puppeteer for the best results.
- **Modern Dashboard**: A sleek, responsive web interface for easy media fetching and management.
- **Queue Management**: Built-in support for Bull + Redis for robust job handling, with an in-memory fallback for local development.
- **Telegram Bot Integration**: Optional Telegram bot support for downloading media directly within the app.
- **Smart Cleanup**: Automated daemon for removing expired files and metadata to save storage.
- **Public API**: Well-documented endpoints for integration with other services.

## 🛠️ Quick Start

### Prerequisites

- Node.js (v16+)
- Python 3 (for `yt-dlp` and `gallery-dl`)
- Redis (optional, for production queue)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Irfan430/Nexus-Downloader.git
   cd Nexus-Downloader
   ```

2. **Install dependencies:**
   ```bash
   npm install
   pip install yt-dlp gallery-dl
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | GET | Check system health status |
| `/dashboard` | GET | Access the web dashboard |
| `/resolve` | GET | Resolve media URL to metadata |
| `/download` | POST | Start a new download job |
| `/status/:jobId` | GET | Check status of a specific job |
| `/file/:jobId` | GET | Download the completed file |

## 🖥️ Dashboard

The dashboard is available at `http://localhost:$PORT/dashboard`. It provides a user-friendly way to:
- Paste and fetch media links.
- Choose from available qualities and formats.
- Monitor active and recent download jobs.
- View system metrics and engine status.

## 🤖 Telegram Bot

To enable the Telegram bot, set `TG_BOT_ENABLED=true` and provide your `TG_BOT_TOKEN` in the `.env` file. The bot supports both private and public modes.

## 📄 License

This project is licensed under the MIT License.

---
Built with ❤️ by [Irfan430](https://github.com/Irfan430)
