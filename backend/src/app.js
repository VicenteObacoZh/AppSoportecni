const express = require('express');
const cors = require('cors');
const config = require('./config');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const liveRoutes = require('./routes/live');
const publicRoutes = require('./routes/public');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      app: config.appName,
      platformBaseUrl: config.platformBaseUrl,
      mockMode: config.mockMode,
      sessionTtlMinutes: config.sessionTtlMinutes
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/live', liveRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/share', publicRoutes);

  app.use((err, _req, res, _next) => {
    res.status(500).json({
      ok: false,
      message: err.message || 'Error inesperado en el backend.'
    });
  });

  return app;
}

module.exports = {
  createApp
};
