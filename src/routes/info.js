const express = require('express');
const router = require('../router');

const route = express.Router();

route.get('/info', async (req, res, next) => {
  try {
    const info = await router.getInfo(req.query.url);
    res.json(info);
  } catch (error) {
    next(error);
  }
});

module.exports = route;
