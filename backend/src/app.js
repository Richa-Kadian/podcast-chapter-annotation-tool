// Builds the Express application. Kept separate from server.js so the
// automated tests can use the app without opening a network port.
const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');
const apiRoutes = require('./routes');
const { notFound } = require('./middleware/notFoundMiddleware');
const { errorHandler } = require('./middleware/errorMiddleware');

const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Only the Momento frontend may call the API from a browser. Requests with no
// Origin header (Postman, Thunder Client, curl) are not affected by CORS.
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.frontendUrls.includes(origin)) return true;
  // During development, allow any local static server (Live Server, http-server, ...)
  return !config.isProduction && LOCALHOST_RE.test(origin);
}

function createApp() {
  const app = express();

  // Render and similar hosts sit behind a proxy; this makes req.ip (used by
  // the rate limiter) the real client address.
  if (config.isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (req, res) => {
    res.json({ success: true, data: { name: 'Momento API', health: '/api/health' } });
  });
  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
