const mongoose = require('mongoose');
const Lecture = require('../models/Lecture');
const Note = require('../models/Note');
const StudyProgress = require('../models/StudyProgress');
const AppError = require('../utils/AppError');
const { isNonEmptyString } = require('../utils/validators');

const MAX_LECTURES_PER_IMPORT = 200;

function describeError(err) {
  if (err instanceof mongoose.Error.ValidationError) {
    return Object.values(err.errors).map((fieldError) => fieldError.message).join('; ');
  }
  return err.message;
}

function toStringArray(value) {
  return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string'))] : [];
}

// Imports one old LocalStorage session with its notes and flashcard piles.
// Returns 'imported' or 'skipped', or throws if the record is invalid.
async function importLecture(item, userId, progress) {
  const existing = await Lecture.exists({ owner: userId, legacyId: item.legacyId });
  if (existing) return 'skipped';

  const bestScore = Number.isFinite(item.bestScore)
    ? Math.min(100, Math.max(0, Math.round(item.bestScore)))
    : null;

  const lecture = await Lecture.create({
    owner: userId, // always the signed-in user, whatever the browser sent
    legacyId: item.legacyId,
    title: item.title,
    type: item.type,
    ytId: item.ytId || undefined,
    mediaUrl: item.mediaUrl || undefined,
    duration: item.duration,
    genre: item.genre,
    lines: item.lines,
    chapters: item.chapters,
    bestScore
  });

  const notes = (Array.isArray(item.notes) ? item.notes : [])
    .filter((note) => note && isNonEmptyString(note.text) && Number.isFinite(note.time) && note.time >= 0)
    .map((note) => ({ user: userId, lecture: lecture._id, text: note.text.slice(0, 2000), time: note.time }));
  if (notes.length) await Note.insertMany(notes);

  const flashcards = item.flashcards || {};
  const known = toStringArray(flashcards.known);
  const studying = toStringArray(flashcards.studying).filter((id) => !known.includes(id));
  if (known.length || studying.length) {
    progress.flashcards.push({ lecture: lecture._id, known, studying });
  }

  return 'imported';
}

// Only fills in the streak for an account that has no study history yet,
// so importing can never overwrite progress already saved in MongoDB.
function importStreak(streak, progress) {
  const hasHistory = progress.lastStudyDate || progress.currentStreak > 0 || progress.bestStreak > 0;
  if (!streak || hasHistory) return false;

  const current = Number.isInteger(streak.current) && streak.current >= 0 ? streak.current : 0;
  const best = Number.isInteger(streak.best) && streak.best >= current ? streak.best : current;
  const lastDate = streak.lastDate ? new Date(streak.lastDate) : null;
  if (current === 0 && best === 0) return false;

  progress.currentStreak = current;
  progress.bestStreak = best;
  progress.lastStudyDate = lastDate && !Number.isNaN(lastDate.getTime()) ? lastDate : null;
  return true;
}

// POST /api/migration/local-storage
// Body: { lectures: [{ legacyId, title, type, ..., notes: [], flashcards: {} }], streak: {} }
// Each lecture is validated on its own: valid ones are imported, already
// imported ones are skipped, and invalid ones are reported back with a reason.
async function importLocalData(req, res) {
  const { lectures = [], streak } = req.body || {};
  if (!Array.isArray(lectures)) {
    throw new AppError(400, 'lectures must be an array');
  }
  if (lectures.length > MAX_LECTURES_PER_IMPORT) {
    throw new AppError(400, `You can import at most ${MAX_LECTURES_PER_IMPORT} lectures at once`);
  }

  const progress = await StudyProgress.findOrCreateForUser(req.user._id);
  const result = { imported: 0, skipped: 0, failed: [], streakImported: false };

  for (const item of lectures) {
    const legacyId = item && item.legacyId;
    if (!isNonEmptyString(legacyId)) {
      result.failed.push({ legacyId: null, title: item && item.title, reason: 'Missing legacyId' });
      continue;
    }
    try {
      const outcome = await importLecture(item, req.user._id, progress);
      result[outcome] += 1;
    } catch (err) {
      result.failed.push({ legacyId, title: item.title, reason: describeError(err) });
    }
  }

  result.streakImported = importStreak(streak, progress);
  await progress.save();

  res.json({ success: true, data: result });
}

module.exports = { importLocalData };
