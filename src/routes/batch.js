const express = require('express');
const queue = require('../services/queue');
const { validateHttpUrl } = require('../utils/urlDetector');
const { newJobId } = require('../utils/fileHelper');

const route = express.Router();

route.post('/batch', async (req, res, next) => {
  try {
    const urls = Array.isArray(req.body.urls) ? req.body.urls : [];
    if (!urls.length || urls.length > 25 || !urls.every(validateHttpUrl)) {
      return res.status(400).json({ success: false, error: 'urls must be an array of 1-25 valid http(s) URLs' });
    }

    const jobs = [];
    for (const url of urls) {
      const job = await queue.enqueueDownload(url, {
        quality: req.body.quality || '720p',
        format: req.body.format || 'mp4',
        audio_only: Boolean(req.body.audio_only),
        webhook_url: req.body.webhook_url
      });
      jobs.push({ url, job_id: job.job_id, status: job.status });
    }

    res.status(202).json({
      success: true,
      batch_id: newJobId('batch'),
      jobs
    });
  } catch (error) {
    next(error);
  }
});

module.exports = route;
