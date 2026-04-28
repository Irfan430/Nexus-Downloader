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

// Function to find Chromium/Chrome path dynamically
function findChromiumPath() {
  const renderChromePath = '/opt/render/project/src/.cache/puppeteer/chrome';
  
  const paths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    // Check for Chrome installed via npx puppeteer browsers install chrome
    // The path structure can vary, so we look for the executable
    path.join(rootDir, '.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome'),
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
  ];

  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null; 
}

const config = {
  rootDir,
  env: 'production',
  port: 3000,
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
  redisUrl: 'redis://localhost:6379',
  queueBackend: 'memory',
  ffmpegPath: '/usr/bin/ffmpeg',
  aria2Path: '/usr/bin/aria2c',
  puppeteerExecutablePath: findChromiumPath(),
  logLevel: 'info',
  webhookSecret: '',
  allowMockEngine: false,
  publicMode: true,
  telegram: {
    enabled: true,
    token: '8140462013:AAEojO-aBUvetf8ERoWfs33jfa9IXq8OxeM',
    publicAccess: true,
    userDelaySeconds: 2,
    ownerIds: [7429947930]
  }
};

module.exports = config;
