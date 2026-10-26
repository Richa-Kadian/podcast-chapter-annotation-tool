const express = require('express');
const { createNote, listNotes, updateNote, deleteNote } = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

// Mounted at /api, because notes are created under a lecture
// (/lectures/:lectureId/notes) but edited on their own (/notes/:id).
const router = express.Router();

router.route('/lectures/:lectureId/notes')
  .get(protect, listNotes)
  .post(protect, createNote);

router.route('/notes/:id')
  .put(protect, updateNote)
  .delete(protect, deleteNote);

module.exports = router;
