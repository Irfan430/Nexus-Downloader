const express = require('express');
const { resolveUrl } = require('../services/resolver');

const route = express.Router();

route.get('/resolve', async (req, res, next) => {
  try {
    const result = await resolveUrl(req.query.url);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = route;
