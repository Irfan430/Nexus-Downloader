const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

function resolveFromRoot(value) {
  if (!value) return rootDir;
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function defaultWritableDir(name) {
  return `./${name}`;
}

// Function to find Chromium path dynamically
function findChromiumPath() {
  const paths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/app/.apt/usr/bin/google-chrome' // Common for some PaaS
  ];

  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null; // Let Puppeteer decide if not found
}

// Hardcoded configuration with dynamic Chromium detection
const config = {
  rootDir,
  env: process.env.NODE_ENV || 'production',
  port: process.env.PORT || 3000,
  apiKeys: ['irfan_secret_key_2026'],
  rateLimitWindowMinutes: 15,
  rateLimitMax: 0,
  rateLimitDisabled: true,
  cobaltApiUrl: 'https://api.cobalt.tools',
  cobaltApiKey: '',
  downloadDir: resolveFromRoot(defaultWritableDir('downloads')),
  logDir: resolveFromRoot(defaultWritableDir('logs')),
  maxConcurrentDownloads: 10,
  downloadConcurrency: 16,
  fileExpireMinutes: 60,
  sentFileExpireSeconds: 120,
  maxFileSizeMb: 4000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  queueBackend: 'memory',
  ffmpegPath: '/usr/bin/ffmpeg',
  aria2Path: '/usr/bin/aria2c',
  puppeteerExecutablePath: findChromiumPath(),
  logLevel: 'info',
  webhookSecret: '',
  allowMockEngine: false,
  publicMode: true,
  telegram: {
    enabled: false,
    token: '',
    publicAccess: true,
    userDelaySeconds: 2,
    ownerIds: []
  }
};

module.exports = config;
