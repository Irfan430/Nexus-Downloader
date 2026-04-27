const express = require('express');
const queue = require('../services/queue');
const { validateHttpUrl } = require('../utils/urlDetector');

const route = express.Router();

function validateBody(body) {
  if (!validateHttpUrl(body.url)) {
    const error = new Error('A valid url is required');
    error.statusCode = 400;
    throw error;
  }
}

route.post('/download', async (req, res, next) => {
  try {
    validateBody(req.body);
    const job = await queue.enqueueDownload(req.body.url, {
      quality: req.body.quality || '720p',
      format: req.body.format || 'mp4',
      format_id: req.body.format_id,
      audio_only: Boolean(req.body.audio_only),
      no_watermark: req.body.no_watermark !== false,
      subtitle: Boolean(req.body.subtitle),
      thumbnail: Boolean(req.body.thumbnail),
      compress: Boolean(req.body.compress),
      webhook_url: req.body.webhook_url
    });
    res.status(202).json({
      success: true,
      job_id: job.job_id,
      fingerprint: job.fingerprint,
      reused: job.reused,
      status: job.status,
      estimated_time: 15,
      check_status: `/status/${job.job_id}`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = route;
