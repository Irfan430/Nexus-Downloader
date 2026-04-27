const express = require('express');
const engines = require('../engines');
const queue = require('../services/queue');
const ffmpeg = require('../services/ffmpeg');

const route = express.Router();
const started = Date.now();

function uptime() {
  const seconds = Math.floor((Date.now() - started) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

route.get('/health', async (req, res) => {
  const [cobalt, ytdlp, gallerydl, puppeteer, capcut, ffmpegOnline, queueStats] = await Promise.all([
    engines.cobalt.isAvailable(),
    engines.ytdlp.isAvailable(),
    engines.gallerydl.isAvailable(),
    engines.puppeteer.isAvailable(),
    engines.capcut.isAvailable(),
    ffmpeg.isAvailable(),
    queue.stats()
  ]);
  res.json({
    status: 'ok',
    engines: {
      capcut: capcut ? 'online' : 'offline',
      cobalt: cobalt ? 'online' : 'offline',
      ytdlp: ytdlp ? 'online' : 'offline',
      gallerydl: gallerydl ? 'online' : 'offline',
      puppeteer: puppeteer ? 'online' : 'offline',
      ffmpeg: ffmpegOnline ? 'online' : 'offline'
    },
    queue: queueStats,
    uptime: uptime()
  });
});

module.exports = route;
