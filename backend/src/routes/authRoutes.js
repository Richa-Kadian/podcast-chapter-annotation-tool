const express = require('express');
const rateLimit = require('express-rate-limit');
const { signup, login, logout, getMe, demoLogin } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { config } = require('../config/env');

const router = express.Router();

// Slows down password guessing: at most 50 failed sign-in/sign-up attempts
// per IP address every 15 minutes (successful ones are not counted).
// Disabled while running automated tests.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again' }
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/demo', authLimiter, demoLogin);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
