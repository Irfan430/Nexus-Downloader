const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const queue = require('./queue');

function cleanupExpiredFiles() {
  const cutoff = Date.now() - config.fileExpireMinutes * 60 * 1000;
  if (!fs.existsSync(config.downloadDir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(config.downloadDir)) {
    if (entry === '.gitkeep') continue;
    const fullPath = path.join(config.downloadDir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      removed += 1;
    }
  }
  if (removed) logger.info('cleanup_removed_files', { removed });
  return removed;
}

function startCleanup() {
  cron.schedule('*/5 * * * *', () => {
    cleanupExpiredFiles();
    queue.cleanupExpiredJobs();
  });
}

module.exports = { cleanupExpiredFiles, startCleanup };
