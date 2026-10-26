const express = require('express');
const { getHealth } = require('../controllers/healthController');
const authRoutes = require('./authRoutes');
const lectureRoutes = require('./lectureRoutes');
const noteRoutes = require('./noteRoutes');
const quizRoutes = require('./quizRoutes');
const progressRoutes = require('./progressRoutes');
const migrationRoutes = require('./migrationRoutes');

// Everything here is mounted under /api in app.js
const router = express.Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/lectures', lectureRoutes);
router.use('/progress', progressRoutes);
router.use('/migration', migrationRoutes);
router.use('/', noteRoutes);
router.use('/', quizRoutes);

module.exports = router;
