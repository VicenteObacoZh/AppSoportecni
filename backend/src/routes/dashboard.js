const express = require('express');
const config = require('../config');
const mockData = require('../data/mockDashboard');

const router = express.Router();

router.get('/', async (_req, res) => {
  if (config.mockMode) {
    return res.json({
      ok: true,
      mode: 'mock',
      data: mockData.dashboard
    });
  }

  return res.status(501).json({
    ok: false,
    mode: 'live',
    message: 'El dashboard real aun no esta conectado. Definir endpoints de unidades, alertas y reportes.'
  });
});

module.exports = router;
