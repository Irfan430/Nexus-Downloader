const express = require('express');
const queue = require('../services/queue');

const route = express.Router();

route.get('/jobs', (req, res) => {
  res.json({
    success: true,
    jobs: queue.listJobs({
      limit: req.query.limit,
      status: req.query.status
    })
  });
});

route.get('/jobs/:jobId', (req, res) => {
  const job = queue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found', code: 'JOB_NOT_FOUND' });
  return res.json({ success: true, job });
});

module.exports = route;
