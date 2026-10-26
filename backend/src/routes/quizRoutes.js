const express = require('express');
const { createQuizAttempt, listQuizAttempts } = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');

// Mounted at /api
const router = express.Router();

router.route('/lectures/:lectureId/quiz-attempts')
  .get(protect, listQuizAttempts)
  .post(protect, createQuizAttempt);

module.exports = router;
