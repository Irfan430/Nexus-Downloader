const engines = require('./engines');
const config = require('./config');
const logger = require('./utils/logger');
const { attachErrorMetadata, classifyError } = require('./utils/errors');
const { enginePreference, validateHttpUrl } = require('./utils/urlDetector');

function engineChain(url) {
  const names = enginePreference(url);
  if (config.allowMockEngine) return ['mock', ...names];
  return names;
}

async function tryInOrder(url, options, action) {
  if (!validateHttpUrl(url)) {
    const error = new Error('A valid http(s) URL is required');
    error.statusCode = 400;
    throw error;
  }

  const failures = [];
  for (const name of engineChain(url)) {
    const engine = engines[name];
    if (!engine || typeof engine[action] !== 'function') continue;
    try {
      logger.info('engine_attempt', { engine: name, action, url });
      const result = await engine[action](url, options);
      if (result && result.success) return { ...result, fallback_failures: failures };
      failures.push({ engine: name, reason: 'Engine returned unsuccessful result' });
    } catch (error) {
      attachErrorMetadata(error);
      logger.warn('engine_failed', { engine: name, action, error: error.message });
      failures.push({ engine: name, code: error.code, reason: error.publicMessage || error.message });
    }
  }

  const primary = failures.find((failure) => failure.code === 'COOKIES_REQUIRED') || failures[failures.length - 1] || {};
  const classified = classifyError({ message: primary.reason || 'All engines failed', code: primary.code });
  const error = new Error(classified.message || 'All engines failed');
  error.code = primary.code || classified.code;
  error.statusCode = classified.statusCode || 502;
  error.publicMessage = classified.message;
  error.details = failures;
  throw error;
}

async function getInfo(url, options = {}) {
  return tryInOrder(url, options, 'info');
}

async function download(url, options = {}) {
  return tryInOrder(url, options, 'download');
}

function getFormats(platform) {
  const video = {
    youtube: ['4K', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'],
    tiktok: ['1080p', '720p', '540p'],
    instagram: ['1080p', '720p', '480p'],
    default: ['best', '1080p', '720p', '480p', '360p']
  };
  return {
    formats: video[platform] || video.default,
    audio: ['320k mp3', '192k mp3', '128k mp3', 'm4a', 'opus']
  };
}

module.exports = {
  download,
  engineChain,
  getFormats,
  getInfo
};
