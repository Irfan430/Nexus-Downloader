const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function resolveFromRoot(value) {
  if (!value) return rootDir;
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function defaultWritableDir(name) {
  return `./${name}`;
}

// Hardcoded configuration to replace .env dependency
const config = {
  rootDir,
  env: 'production',
  port: 3000,
  apiKeys: ['irfan_secret_key_2026'], // Default API Key
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
  redisUrl: 'redis://localhost:6379',
  queueBackend: 'memory', // Default to memory for easier setup
  ffmpegPath: '/usr/bin/ffmpeg',
  aria2Path: '/usr/bin/aria2c',
  puppeteerExecutablePath: '/usr/bin/chromium',
  logLevel: 'info',
  webhookSecret: '',
  allowMockEngine: false,
  publicMode: true,
  telegram: {
    enabled: false, // Disabled by default
    token: '',
    publicAccess: true,
    userDelaySeconds: 2,
    ownerIds: []
  }
};

module.exports = config;
