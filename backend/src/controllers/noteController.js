const mongoose = require('mongoose');
const Note = require('../models/Note');
const AppError = require('../utils/AppError');
const { findOwnedLecture } = require('../services/lectureAccess');

// Same 400 / 404 / 403 rules as findOwnedLecture, but for a single note.
async function findOwnedNote(noteId, userId) {
  if (!mongoose.isValidObjectId(noteId)) {
    throw new AppError(400, 'Invalid note id');
  }
  const note = await Note.findById(noteId);
  if (!note) {
    throw new AppError(404, 'Note not found');
  }
  if (!note.user.equals(userId)) {
    throw new AppError(403, 'You do not have permission to access this note');
  }
  return note;
}

// POST /api/lectures/:lectureId/notes
async function createNote(req, res) {
  const lecture = await findOwnedLecture(req.params.lectureId, req.user._id, '_id owner');
  const { text, time } = req.body || {};

  const note = await Note.create({
    user: req.user._id,
    lecture: lecture._id,
    text,
    time
  });
  res.status(201).json({ success: true, data: note });
}

// GET /api/lectures/:lectureId/notes
async function listNotes(req, res) {
  const lecture = await findOwnedLecture(req.params.lectureId, req.user._id, '_id owner');
  const notes = await Note.find({ lecture: lecture._id, user: req.user._id }).sort({ createdAt: 1 });
  res.json({ success: true, data: notes });
}

// PUT /api/notes/:id
async function updateNote(req, res) {
  const note = await findOwnedNote(req.params.id, req.user._id);
  const { text, time } = req.body || {};

  if (text === undefined && time === undefined) {
    throw new AppError(400, 'Nothing to update. Allowed fields: text, time');
  }
  if (text !== undefined) note.text = text;
  if (time !== undefined) note.time = time;

  await note.save();
  res.json({ success: true, data: note });
}

// DELETE /api/notes/:id
async function deleteNote(req, res) {
  const note = await findOwnedNote(req.params.id, req.user._id);
  await note.deleteOne();
  res.json({ success: true, data: { message: 'Note deleted', id: note.id } });
}

module.exports = { createNote, listNotes, updateNote, deleteNote };
