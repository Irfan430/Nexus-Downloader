const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

function signPayload(payload) {
  if (!config.webhookSecret) return undefined;
  return crypto.createHmac('sha256', config.webhookSecret).update(JSON.stringify(payload)).digest('hex');
}

async function sendWebhook(url, payload) {
  if (!url) return;
  try {
    const signature = signPayload(payload);
    await axios.post(url, payload, {
      timeout: 10000,
      headers: signature ? { 'x-webhook-signature': signature } : undefined
    });
  } catch (error) {
    logger.warn('webhook_failed', { url, error: error.message });
  }
}

module.exports = { sendWebhook };
