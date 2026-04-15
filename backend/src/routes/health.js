const express = require('express');
const config = require('../config');
const { validatePlatformAvailability } = require('../services/platformClient');

const router = express.Router();

router.get('/', async (_req, res) => {
  if (config.mockMode) {
    return res.json({
      ok: true,
      mode: 'mock',
      platformBaseUrl: config.platformBaseUrl
    });
  }

  try {
    const result = await validatePlatformAvailability();
    return res.json({
      ok: true,
      mode: 'live',
      platformBaseUrl: config.platformBaseUrl,
      platformStatus: result.status,
      isLoginScreen: result.isLoginScreen
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      mode: 'live',
      message: error.message
    });
  }
});

module.exports = router;
