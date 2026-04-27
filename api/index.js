const { createApp } = require('../src/index');
const queue = require('../src/services/queue');
const { ensureDirectories } = require('../src/utils/fileHelper');
const { startCleanup } = require('../src/services/cleanup');

let ready;

function boot() {
  if (!ready) {
    ready = (async () => {
      ensureDirectories();
      await queue.initQueue();
      startCleanup();
    })();
  }
  return ready;
}

module.exports = createApp({
  beforeRoutes: async (req, res, next) => {
    try {
      await boot();
      next();
    } catch (error) {
      next(error);
    }
  }
});
