const StudyProgress = require('../models/StudyProgress');
const AppError = require('../utils/AppError');
const { findOwnedLecture } = require('../services/lectureAccess');
const { toStreakResponse } = require('../services/streakService');

const MAX_CARD_IDS = 5000;

// GET /api/progress
// The streak is read-only here: it only changes when a quiz attempt is saved
// (see quizController), so a client cannot simply set its own streak.
async function getProgress(req, res) {
  const progress = await StudyProgress.findOrCreateForUser(req.user._id);
  res.json({
    success: true,
    data: {
      streak: toStreakResponse(progress),
      flashcardDecks: progress.flashcards.length
    }
  });
}

// DELETE /api/progress — part of the "Reset demo data" button.
async function resetProgress(req, res) {
  await StudyProgress.updateOne(
    { user: req.user._id },
    { $set: { currentStreak: 0, bestStreak: 0, lastStudyDate: null, flashcards: [] } }
  );
  res.json({ success: true, data: { message: 'Study progress reset' } });
}

function findDeck(progress, lectureId) {
  return progress.flashcards.find((deck) => deck.lecture.equals(lectureId));
}

// GET /api/progress/flashcards/:lectureId
async function getFlashcards(req, res) {
  const lecture = await findOwnedLecture(req.params.lectureId, req.user._id, '_id owner');
  const progress = await StudyProgress.findOrCreateForUser(req.user._id);
  const deck = findDeck(progress, lecture._id);

  res.json({
    success: true,
    data: { lecture: lecture.id, known: deck ? deck.known : [], studying: deck ? deck.studying : [] }
  });
}

function cleanCardIds(value, fieldName) {
  if (!Array.isArray(value) || value.length > MAX_CARD_IDS || !value.every((id) => typeof id === 'string')) {
    throw new AppError(400, `${fieldName} must be an array of card id strings`);
  }
  return [...new Set(value)];
}

// PUT /api/progress/flashcards/:lectureId   body: { known: [...], studying: [...] }
async function saveFlashcards(req, res) {
  const lecture = await findOwnedLecture(req.params.lectureId, req.user._id, '_id owner');
  const body = req.body || {};
  const known = cleanCardIds(body.known, 'known');
  const studying = cleanCardIds(body.studying, 'studying');

  // A card sits in exactly one pile, like in the UI.
  if (known.some((id) => studying.includes(id))) {
    throw new AppError(400, 'A card cannot be both known and still studying');
  }

  const progress = await StudyProgress.findOrCreateForUser(req.user._id);
  const deck = findDeck(progress, lecture._id);
  if (deck) {
    deck.known = known;
    deck.studying = studying;
  } else {
    progress.flashcards.push({ lecture: lecture._id, known, studying });
  }
  await progress.save();

  res.json({ success: true, data: { lecture: lecture.id, known, studying } });
}

module.exports = { getProgress, resetProgress, getFlashcards, saveFlashcards };
