const rateLimit = require('express-rate-limit');
const config = require('../config');

const disabled = config.rateLimitDisabled || !Number.isFinite(config.rateLimitMax) || config.rateLimitMax <= 0;

module.exports = disabled
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: config.rateLimitWindowMinutes * 60 * 1000,
      limit: config.rateLimitMax,
      keyGenerator: (req) => (config.env === 'test' && req.get('x-test-client')) || req.ip,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: 'Rate limit exceeded' },
      skip: (req) => req.path === '/health'
    });
