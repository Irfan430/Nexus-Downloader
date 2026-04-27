const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const rootDir = path.resolve(__dirname, '..');

function intFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
}

function boolFromEnv(name, fallback = false) {
  if (process.env[name] == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name]).toLowerCase());
}

function resolveFromRoot(value) {
  if (!value) return rootDir;
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function defaultWritableDir(name) {
  if (process.env.VERCEL) return path.join('/tmp', `media-downloader-${name}`);
  return `./${name}`;
}

const apiKeys = (process.env.API_KEYS || process.env.API_KEY || 'change_this_to_random_secret_key')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);

module.exports = {
  rootDir,
  env: process.env.NODE_ENV || 'development',
  port: intFromEnv('PORT', 3000),
  apiKeys,
  rateLimitWindowMinutes: intFromEnv('RATE_LIMIT_WINDOW', 15),
  rateLimitMax: intFromEnv('RATE_LIMIT_MAX', 0),
  rateLimitDisabled: boolFromEnv('RATE_LIMIT_DISABLED', true),
  cobaltApiUrl: process.env.COBALT_API_URL || 'https://co.wuk.sh',
  cobaltApiKey: process.env.COBALT_API_KEY || '',
  downloadDir: resolveFromRoot(process.env.DOWNLOAD_DIR || defaultWritableDir('downloads')),
  logDir: resolveFromRoot(process.env.LOG_DIR || defaultWritableDir('logs')),
  maxConcurrentDownloads: intFromEnv('MAX_CONCURRENT_DOWNLOADS', 5),
  downloadConcurrency: intFromEnv('DOWNLOAD_CONCURRENCY', 8),
  fileExpireMinutes: intFromEnv('FILE_EXPIRE_MINUTES', 30),
  sentFileExpireSeconds: intFromEnv('SENT_FILE_EXPIRE_SECONDS', 60),
  maxFileSizeMb: intFromEnv('MAX_FILE_SIZE_MB', 2000),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  queueBackend: process.env.QUEUE_BACKEND || 'auto',
  ffmpegPath: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
  aria2Path: process.env.ARIA2_PATH || '/usr/bin/aria2c',
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  logLevel: process.env.LOG_LEVEL || 'info',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  allowMockEngine: boolFromEnv('ALLOW_MOCK_ENGINE', process.env.NODE_ENV === 'test'),
  publicMode: boolFromEnv('PUBLIC_MODE', true),
  telegram: {
    enabled: boolFromEnv('TG_BOT_ENABLED', Boolean(process.env.TG_BOT_TOKEN)),
    token: process.env.TG_BOT_TOKEN || '',
    publicAccess: boolFromEnv('TG_PUBLIC_ACCESS', false),
    userDelaySeconds: intFromEnv('TG_USER_DELAY_SECONDS', 4),
    ownerIds: (process.env.TG_OWNER_IDS || process.env.TG_OWNER_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }
};
