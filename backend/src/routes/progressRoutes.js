const express = require('express');
const { getProgress, resetProgress, getFlashcards, saveFlashcards } = require('../controllers/progressController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getProgress)
  .delete(resetProgress);

router.route('/flashcards/:lectureId')
  .get(getFlashcards)
  .put(saveFlashcards);

module.exports = router;
