const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { createToken } = require('../services/tokenService');
const { config } = require('../config/env');
const { normalizeEmail, isValidEmail, isStrongPassword } = require('../utils/validators');

const DUMMY_HASH = bcrypt.hashSync('momento-dummy-password', 10);

function sendAuthResponse(res, statusCode, user) {
  res.status(statusCode).json({
    success: true,
    data: { token: createToken(user), user }
  });
}

// POST /api/auth/signup
async function signup(req, res) {
  const { name, email, password } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = normalizeEmail(email);

  const errors = {};
  if (cleanName.length < 2 || cleanName.length > 60) {
    errors.name = 'Name must be between 2 and 60 characters';
  }
  if (!isValidEmail(cleanEmail)) {
    errors.email = 'Please enter a valid email address';
  }
  if (!isStrongPassword(password)) {
    errors.password = 'Password must be at least 8 characters and include a number and a special character';
  }
  if (Object.keys(errors).length) {
    throw new AppError(400, 'Please fix the highlighted fields', errors);
  }

  const existingUser = await User.exists({ email: cleanEmail });
  if (existingUser) {
    throw new AppError(409, 'An account with this email already exists');
  }

  // The pre-save hook in models/User.js hashes the password.
  const user = await User.create({ name: cleanName, email: cleanEmail, password });
  sendAuthResponse(res, 201, user);
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || typeof password !== 'string' || !password) {
    throw new AppError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email: cleanEmail }).select('+password +tokenVersion');
  // When the email is unknown we still run one bcrypt comparison, so the
  // response time doesn't reveal whether the account exists.
  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

  // Same message for "no such email" and "wrong password", so the response
  // doesn't reveal which emails have accounts.
  if (!passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  sendAuthResponse(res, 200, user);
}

// POST /api/auth/logout  (protected)
// Bumping tokenVersion invalidates every token issued to this user so far.
async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, data: { message: 'Signed out successfully' } });
}

// GET /api/auth/me  (protected)
async function getMe(req, res) {
  res.json({ success: true, data: { user: req.user } });
}

// POST /api/auth/demo
// Replaces the old "any email containing demo logs in" shortcut. It only works
// when DEMO_LOGIN_ENABLED=true is set on the server, and always signs in the
// same dedicated demo account, which has a random password nobody knows.
async function demoLogin(req, res) {
  if (!config.demoLoginEnabled) {
    throw new AppError(404, 'Demo login is not enabled on this server');
  }

  let user = await User.findOne({ email: config.demoEmail }).select('+tokenVersion');
  if (!user) {
    user = await User.create({
      name: 'Evaluation Student',
      email: config.demoEmail,
      password: crypto.randomBytes(32).toString('hex'),
      isDemo: true
    });
  } else if (!user.isDemo) {
    // Never hand out a real person's account through the demo button.
    throw new AppError(409, 'The demo email belongs to a regular account. Change DEMO_EMAIL on the server');
  }

  sendAuthResponse(res, 200, user);
}

module.exports = { signup, login, logout, getMe, demoLogin };
