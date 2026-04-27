const express = require('express');
const smartRouter = require('../router');
const { detectPlatform, validateHttpUrl } = require('../utils/urlDetector');
const { buildQualityChoices } = require('../services/chatbotFlow');

const route = express.Router();

route.get('/formats', async (req, res, next) => {
  try {
    if (!validateHttpUrl(req.query.url)) {
      return res.status(400).json({ success: false, error: 'A valid url query parameter is required' });
    }
    const platform = detectPlatform(req.query.url);
    const info = await smartRouter.getInfo(req.query.url);
    const choices = buildQualityChoices(info);
    res.json({
      success: true,
      platform: info.platform || platform,
      title: info.title || null,
      duration: info.duration || null,
      formats: choices.filter((choice) => choice.type === 'video').map((choice) => choice.label),
      audio: choices.filter((choice) => choice.type === 'audio').map((choice) => choice.label),
      choices,
      fallback: choices.length ? undefined : smartRouter.getFormats(platform)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = route;
