const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { ensureDirectories } = require('./utils/fileHelper');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');
const queue = require('./services/queue');
const { startCleanup } = require('./services/cleanup');
const { startTelegramBot } = require('./services/telegramBot');

function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
  app.use(rateLimit);
  app.use(auth);
  if (typeof options.beforeRoutes === 'function') app.use(options.beforeRoutes);
  for (const route of routes) app.use(route);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  ensureDirectories();
  await queue.initQueue();
  startCleanup();
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('server_started', { port: config.port, env: config.env });
    console.log(`Media Downloader API listening on http://127.0.0.1:${config.port}`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error('server_port_in_use', { port: config.port });
      console.error(`Port ${config.port} is already in use. Stop the existing daemon or set a different PORT.`);
      process.exit(1);
    }
    throw error;
  });
  startTelegramBotWithRetry();
  return server;
}

function startTelegramBotWithRetry(attempt = 1) {
  if (!config.telegram.enabled) return;

  startTelegramBot().catch((error) => {
    const retryMs = Math.min(30000, 5000 * attempt);
    logger.warn('telegram_bot_start_failed', { attempt, retry_ms: retryMs, error: error.message });
    setTimeout(() => startTelegramBotWithRetry(attempt + 1), retryMs);
  });
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('startup_failed', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = { createApp, start, startTelegramBotWithRetry };
