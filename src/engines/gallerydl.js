const path = require('path');
const { runCommand } = require('./process');
const { detectPlatform } = require('../utils/urlDetector');
const { fileInfo } = require('../utils/fileHelper');
const config = require('../config');

const gallerydl = {
  name: 'gallerydl',

  async isAvailable() {
    try {
      await runCommand('gallery-dl', ['--version'], { timeoutMs: 10000 });
      return true;
    } catch {
      return false;
    }
  },

  async info(url) {
    const { stdout } = await runCommand('gallery-dl', ['--simulate', '--dump-json', url], {
      timeoutMs: 60000,
      maxBuffer: 1024 * 1024 * 25
    });
    const firstLine = stdout.split('\n').find(Boolean);
    const data = firstLine ? JSON.parse(firstLine) : {};
    return {
      success: true,
      engine: 'gallerydl',
      platform: detectPlatform(url),
      title: data.title || data.filename || null,
      thumbnail: data.thumbnail || null,
      duration: null,
      uploader: data.author || data.user || null,
      view_count: null,
      formats: [{ id: 'original', quality: 'original', ext: data.extension || 'jpg', filesize: null }],
      audio_formats: []
    };
  },

  async download(url, options = {}) {
    const outDir = path.join(config.downloadDir, options.jobId);
    await runCommand('gallery-dl', ['--directory', outDir, url], { timeoutMs: 1000 * 60 * 20 });
    return {
      success: true,
      engine: 'gallerydl',
      platform: detectPlatform(url),
      directory: outDir,
      file: fileInfo(outDir)
    };
  }
};

module.exports = gallerydl;
