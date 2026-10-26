const { isDatabaseConnected } = require('../config/database');

// GET /api/health — public. Reports whether the API is up and can reach
// MongoDB, without revealing the connection string or any other config.
function getHealth(req, res) {
  const databaseConnected = isDatabaseConnected();
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: {
      status: databaseConnected ? 'ok' : 'degraded',
      database: databaseConnected ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = { getHealth };
