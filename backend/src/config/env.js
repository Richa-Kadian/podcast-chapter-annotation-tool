// Loads environment variables from backend/.env and exposes them as one
// config object, so the rest of the code never reads process.env directly.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5050,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  // Comma-separated list, e.g. "http://localhost:5500,https://momento.onrender.com"
  frontendUrls: (process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
  demoLoginEnabled: process.env.DEMO_LOGIN_ENABLED === 'true',
  demoEmail: (process.env.DEMO_EMAIL || 'student@momento.ai').toLowerCase()
};

// Fail fast on startup instead of failing on the first request.
function validateConfig() {
  const missing = [];
  if (!config.mongodbUri) missing.push('MONGODB_URI');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See backend/.env.example.`);
  }
  if (config.isProduction && config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production.');
  }
}

module.exports = { config, validateConfig };
