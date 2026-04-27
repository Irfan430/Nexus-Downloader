const express = require('express');
const queue = require('../services/queue');
const { validateHttpUrl } = require('../utils/urlDetector');

const route = express.Router();

route.post('/audio', async (req, res, next) => {
  try {
    if (!validateHttpUrl(req.body.url)) {
      return res.status(400).json({ success: false, error: 'A valid url is required' });
    }
    const job = await queue.enqueueDownload(req.body.url, {
      quality: req.body.quality || '320k',
      format: req.body.format || 'mp3',
      format_id: req.body.format_id,
      audio_only: true,
      embed_metadata: req.body.embed_metadata !== false,
      embed_thumbnail: req.body.embed_thumbnail !== false,
      webhook_url: req.body.webhook_url
    });
    res.status(202).json({
      success: true,
      job_id: job.job_id,
      fingerprint: job.fingerprint,
      reused: job.reused,
      status: job.status,
      estimated_time: 10,
      check_status: `/status/${job.job_id}`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = route;
