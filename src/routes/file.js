const fs = require('fs');
const path = require('path');
const express = require('express');
const queue = require('../services/queue');

const route = express.Router();

route.get('/file/:jobId', (req, res) => {
  const job = queue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  if (job.status !== 'ready') return res.status(409).json({ success: false, error: 'File is not ready' });
  if (job.remote_url) return res.redirect(job.remote_url);
  if (!job.file || !job.file.path || !fs.existsSync(job.file.path)) {
    return res.status(404).json({ success: false, error: 'File not found or expired' });
  }
  return res.download(job.file.path, path.basename(job.file.path));
});

module.exports = route;
