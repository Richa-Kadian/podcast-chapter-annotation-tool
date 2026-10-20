const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware'); // Express Middleware validating JWT

router.get('/dashboard', authMiddleware, profileController.getUserDashboard);

module.exports = router;
