const path = require('path');
const express = require('express');

const route = express.Router();
const publicDir = path.resolve(__dirname, '..', 'public');

route.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});

route.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});

route.use('/dashboard/assets', express.static(publicDir, {
  etag: true,
  maxAge: '1h'
}));

module.exports = route;
