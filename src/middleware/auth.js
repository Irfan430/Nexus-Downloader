const crypto = require('crypto');
const config = require('../config');

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isPublicPath(req) {
  if (req.path === '/health') return true;
  if (req.path === '/' || req.path === '/dashboard') return true;
  if (req.path.startsWith('/dashboard/assets/')) return true;
  return false;
}

function auth(req, res, next) {
  if (isPublicPath(req)) return next();
  if (config.publicMode) return next();
  const provided = req.get('x-api-key');
  if (!provided || !config.apiKeys.some((key) => timingSafeEqualString(provided, key))) {
    return res.status(401).json({ success: false, error: 'Valid x-api-key header required' });
  }
  return next();
}

module.exports = auth;
