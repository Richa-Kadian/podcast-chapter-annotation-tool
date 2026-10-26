const User = require('../models/User');
const AppError = require('../utils/AppError');
const { verifyToken } = require('../services/tokenService');

// Protects private routes. Expects the header  Authorization: Bearer <token>.
// On success, req.user is the signed-in user loaded from MongoDB — controllers
// use req.user._id as the owner of everything, never an id sent by the client.
async function protect(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Please sign in to continue');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Your session has expired. Please sign in again'
      : 'Invalid authentication token';
    throw new AppError(401, message);
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  // A token issued before the user logged out carries an old version number.
  if (!user || user.tokenVersion !== payload.ver) {
    throw new AppError(401, 'Your session is no longer valid. Please sign in again');
  }

  req.user = user;
  next();
}

module.exports = { protect };
