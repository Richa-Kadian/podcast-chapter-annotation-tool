const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

// The token only identifies the user (sub) and the user's current
// tokenVersion (ver). Everything else is looked up in MongoDB on each request.
function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), ver: user.tokenVersion || 0 },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Throws if the token is expired, tampered with or signed with another secret.
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { createToken, verifyToken };
