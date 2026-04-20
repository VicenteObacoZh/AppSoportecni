const express = require('express');
const config = require('../config');
const { validatePlatformAvailability } = require('../services/platformClient');

const router = express.Router();

router.get('/', async (_req, res) => {
  if (config.mockMode) {
    return res.json({
      ok: true,
      mode: 'mock',
      mockMode: true,
      platformBaseUrl: config.platformBaseUrl,
      sessionTtlMinutes: config.sessionTtlMinutes,
      capabilities: {
        login: true,
        sessionId: true,
        monitor: true,
        alerts: true,
        route: true
      }
    });
  }

  try {
    const result = await validatePlatformAvailability();
    return res.json({
      ok: true,
      mode: 'live',
      mockMode: false,
      platformBaseUrl: config.platformBaseUrl,
      sessionTtlMinutes: config.sessionTtlMinutes,
      platformStatus: result.status,
      isLoginScreen: result.isLoginScreen,
      capabilities: {
        login: true,
        sessionId: true,
        monitor: true,
        alerts: true,
        route: true
      }
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
