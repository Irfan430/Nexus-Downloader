const config = require('../config');
const logger = require('../utils/logger');
const queue = require('./queue');
const { resolveUrl } = require('./resolver');
const {
  buildQualityChoices,
  buildSelectionKeyboard,
  createDeliveryGuard,
  deliveryKey
} = require('./chatbotFlow');

const selectionSessions = new Map();
const deliveryGuard = createDeliveryGuard();
const userCooldown = createUserCooldown(config.telegram.userDelaySeconds);
const SELECTION_TTL_MS = 15 * 60 * 1000;

function extractFirstUrl(text = '') {
  const match = String(text).match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function isAllowedUser(user, ownerIds, publicAccess = false) {
  if (!user || !user.id) return false;
  if (publicAccess) return true;
  if (!ownerIds.length) return false;
  return ownerIds.includes(String(user.id));
}

function createUserCooldown(delaySeconds = 4) {
  const lastSeen = new Map();
  return {
    check(userId) {
      const key = String(userId || '');
      const now = Date.now();
      const waitMs = Number(delaySeconds) * 1000 - (now - (lastSeen.get(key) || 0));
      if (waitMs > 0) return { allowed: false, wait_seconds: Math.ceil(waitMs / 1000) };
      lastSeen.set(key, now);
      return { allowed: true, wait_seconds: 0 };
    }
  };
}

function secondsLabel(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  return `${seconds}s`;
}

function formatResolveMessage(result) {
  const lines = [
    `Title: ${result.title || 'Unknown'}`,
    `Platform: ${result.platform || 'unknown'}`,
    `Duration: ${secondsLabel(result.duration)}`,
    'Choose quality to download:'
  ];
  if (result.links?.high?.quality) lines.push(`High: ${result.links.high.quality}`);
  if (result.links?.low?.quality) lines.push(`Low: ${result.links.low.quality}`);
  if (result.links?.audio?.quality) lines.push(`Audio: ${result.links.audio.quality}`);
  return lines.join('\n');
}

function removeKeyboardOptions(extra = {}) {
  return {
    ...extra,
    reply_markup: { remove_keyboard: true }
  };
}

function selectPreferredVideoLink(result) {
  const high = result?.links?.high;
  const low = result?.links?.low;
  const selected = high?.url ? high : low?.url ? low : null;
  if (!selected?.url) return null;
  return {
    url: selected.url,
    quality: selected.quality || 'video'
  };
}

function createSelection(chatId, url, choices) {
  const id = Math.random().toString(36).slice(2, 10);
  selectionSessions.set(id, {
    chatId,
    url,
    choices,
    createdAt: Date.now()
  });
  return id;
}

function getSelection(id, chatId) {
  const session = selectionSessions.get(id);
  if (!session) return null;
  if (session.chatId !== chatId || Date.now() - session.createdAt > SELECTION_TTL_MS) {
    selectionSessions.delete(id);
    return null;
  }
  return session;
}

function cleanupSelections() {
  const now = Date.now();
  for (const [id, session] of selectionSessions.entries()) {
    if (now - session.createdAt > SELECTION_TTL_MS) selectionSessions.delete(id);
  }
}

async function sendQueuedDownload(bot, chatId, url, options = {}) {
  const downloadOptions = {
    quality: options.quality || '720p',
    format: options.format || 'mp4',
    format_id: options.format_id,
    audio_only: Boolean(options.audio_only),
    no_watermark: options.no_watermark !== false
  };
  const key = deliveryKey(chatId, url, downloadOptions);
  if (!deliveryGuard.begin(key)) {
    await bot.telegram.sendMessage(chatId, 'This download is already processing or already sent once.', removeKeyboardOptions());
    return null;
  }

  const job = await queue.enqueueDownload(url, downloadOptions);
  await bot.telegram.sendMessage(
    chatId,
    `Download queued:\nQuality: ${downloadOptions.audio_only ? `audio ${downloadOptions.quality}` : downloadOptions.quality}\nJob: ${job.job_id}`,
    removeKeyboardOptions()
  );

  const finished = await queue.waitForJob(job.job_id);
  if (!finished || finished.status !== 'ready') {
    const reason = finished?.error ? `\nError: ${finished.error}` : '';
    await bot.telegram.sendMessage(chatId, `Download failed or timed out.${reason}`, removeKeyboardOptions());
    deliveryGuard.release(key);
    return finished;
  }

  const caption = `Ready: ${finished.platform || 'media'}${finished.engine_used ? ` via ${finished.engine_used}` : ''}`;
  if (finished.file?.path) {
    await bot.telegram.sendVideo(chatId, { source: finished.file.path }, { caption, ...removeKeyboardOptions(), supports_streaming: true });
    deliveryGuard.complete(key);
    queue.scheduleJobCleanup(finished.job_id);
    return finished;
  }
  if (finished.remote_url) {
    await bot.telegram.sendVideo(chatId, finished.remote_url, { caption, ...removeKeyboardOptions() });
    deliveryGuard.complete(key);
    queue.scheduleJobCleanup(finished.job_id);
    return finished;
  }
  if (Array.isArray(finished.picker) && finished.picker.length) {
    const picked = finished.picker.find((item) => item?.url || typeof item === 'string');
    const pickedUrl = typeof picked === 'string' ? picked : picked?.url;
    if (pickedUrl) {
      await bot.telegram.sendVideo(chatId, pickedUrl, { caption, ...removeKeyboardOptions() });
      deliveryGuard.complete(key);
      queue.scheduleJobCleanup(finished.job_id);
      return finished;
    }
  }

  await bot.telegram.sendMessage(chatId, 'Download finished, but no sendable file was produced.', removeKeyboardOptions());
  deliveryGuard.release(key);
  return finished;
}

async function handleUrl(bot, chatId, url) {
  const resolving = await bot.telegram.sendMessage(chatId, 'Resolving video...', removeKeyboardOptions());
  try {
    const result = await resolveUrl(url);
    const choices = buildQualityChoices(result);
    if (!choices.length) return sendQueuedDownload(bot, chatId, url);
    cleanupSelections();
    const sessionId = createSelection(chatId, url, choices);
    await bot.telegram.sendMessage(chatId, formatResolveMessage(result), {
      reply_markup: buildSelectionKeyboard(sessionId, choices),
      disable_web_page_preview: true
    });
  } catch (error) {
    logger.warn('telegram_resolve_failed', { error: error.message, url });
    await bot.telegram.sendMessage(chatId, 'Quality list unavailable. Trying best server-side download once...', removeKeyboardOptions());
    await sendQueuedDownload(bot, chatId, url);
  } finally {
    if (resolving?.message_id) {
      bot.telegram.deleteMessage(chatId, resolving.message_id).catch(() => {});
    }
  }
}

async function startTelegramBot() {
  if (!config.telegram.enabled) return null;
  if (!config.telegram.token || (!config.telegram.publicAccess && !config.telegram.ownerIds.length)) {
    logger.warn('telegram_bot_disabled_missing_config');
    return null;
  }

  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(config.telegram.token);

  bot.start((ctx) => {
    if (!isAllowedUser(ctx.from, config.telegram.ownerIds, config.telegram.publicAccess)) return;
    return ctx.reply([
      'Media Downloader API bot is online.',
      'Send any video URL to resolve direct links.',
      'Use /download <url> to force server-side queued download.'
    ].join('\n'), removeKeyboardOptions());
  });

  bot.help((ctx) => {
    if (!isAllowedUser(ctx.from, config.telegram.ownerIds, config.telegram.publicAccess)) return;
    return ctx.reply('Send any video URL, or use /download <url> for server-side queued download.', removeKeyboardOptions());
  });

  bot.command('download', async (ctx) => {
    if (!isAllowedUser(ctx.from, config.telegram.ownerIds, config.telegram.publicAccess)) return;
    const cooldown = userCooldown.check(ctx.from.id);
    if (!cooldown.allowed) return ctx.reply(`Please wait ${cooldown.wait_seconds}s before the next request.`, removeKeyboardOptions());
    const url = extractFirstUrl(ctx.message?.text || '');
    if (!url) return ctx.reply('Send /download followed by a valid URL.', removeKeyboardOptions());
    await sendQueuedDownload(bot, ctx.chat.id, url);
  });

  bot.on('callback_query', async (ctx) => {
    if (!isAllowedUser(ctx.from, config.telegram.ownerIds, config.telegram.publicAccess)) return;
    const cooldown = userCooldown.check(ctx.from.id);
    if (!cooldown.allowed) {
      await ctx.answerCbQuery(`Wait ${cooldown.wait_seconds}s`);
      return;
    }
    const data = String(ctx.callbackQuery?.data || '');
    const match = data.match(/^dl:([^:]+):(\d+)$/);
    if (!match) return;
    const session = getSelection(match[1], ctx.chat.id);
    const choice = session?.choices?.[Number(match[2])];
    if (!session || !choice) {
      await ctx.answerCbQuery('Selection expired. Send the link again.');
      return;
    }
    await ctx.answerCbQuery(`Downloading ${choice.label}`);
    await sendQueuedDownload(bot, ctx.chat.id, session.url, choice.options);
  });

  bot.on('text', async (ctx) => {
    if (ctx.message.text?.startsWith('/')) return;
    if (!isAllowedUser(ctx.from, config.telegram.ownerIds, config.telegram.publicAccess)) return;
    const cooldown = userCooldown.check(ctx.from.id);
    if (!cooldown.allowed) return ctx.reply(`Please wait ${cooldown.wait_seconds}s before the next request.`, removeKeyboardOptions());
    const url = extractFirstUrl(ctx.message.text);
    if (!url) return;
    await handleUrl(bot, ctx.chat.id, url);
  });

  bot.catch((error) => logger.warn('telegram_bot_error', { error: error.message }));
  await bot.launch();
  for (const ownerId of config.telegram.ownerIds) {
    bot.telegram.sendMessage(ownerId, 'Media Downloader API bot is online.', removeKeyboardOptions()).catch((error) => {
      logger.warn('telegram_owner_notify_failed', { error: error.message, ownerId });
    });
  }
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  logger.info('telegram_bot_started', { owners: config.telegram.ownerIds.length });
  return bot;
}

module.exports = {
  extractFirstUrl,
  formatResolveMessage,
  createUserCooldown,
  isAllowedUser,
  removeKeyboardOptions,
  selectPreferredVideoLink,
  cleanupSelections,
  createSelection,
  getSelection,
  sendQueuedDownload,
  startTelegramBot
};
