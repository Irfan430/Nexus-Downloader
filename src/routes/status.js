const express = require('express');
const queue = require('../services/queue');

const route = express.Router();

route.get('/status/:jobId', (req, res) => {
  const job = queue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  return res.json(job);
});

module.exports = route;
