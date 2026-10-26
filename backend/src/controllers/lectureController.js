const Lecture = require('../models/Lecture');
const Note = require('../models/Note');
const QuizAttempt = require('../models/QuizAttempt');
const StudyProgress = require('../models/StudyProgress');
const AppError = require('../utils/AppError');
const { findOwnedLecture } = require('../services/lectureAccess');

// Fields a client may set. owner, bestScore and legacyId are deliberately
// missing: the server decides those.
const CREATE_FIELDS = ['title', 'type', 'ytId', 'mediaUrl', 'duration', 'genre', 'lines', 'chapters'];
const UPDATE_FIELDS = ['title', 'duration', 'genre', 'lines', 'chapters'];

function pickFields(body, allowedFields) {
  const picked = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) picked[field] = body[field];
  });
  return picked;
}

// POST /api/lectures
async function createLecture(req, res) {
  const data = pickFields(req.body || {}, CREATE_FIELDS);
  const lecture = await Lecture.create({ ...data, owner: req.user._id });
  res.status(201).json({ success: true, data: lecture });
}

// GET /api/lectures
// The library only needs titles, durations, chapter counts and scores, so the
// (potentially long) transcript is left out. GET /api/lectures/:id returns it.
async function listLectures(req, res) {
  const lectures = await Lecture.find({ owner: req.user._id })
    .select('-lines')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: lectures });
}

// GET /api/lectures/:id
async function getLecture(req, res) {
  const lecture = await findOwnedLecture(req.params.id, req.user._id);
  res.json({ success: true, data: lecture });
}

// PUT /api/lectures/:id
// Used when a YouTube video reports its real length and the transcript and
// chapters are regenerated, and for renaming a lecture.
async function updateLecture(req, res) {
  const updates = pickFields(req.body || {}, UPDATE_FIELDS);
  if (Object.keys(updates).length === 0) {
    throw new AppError(400, `Nothing to update. Allowed fields: ${UPDATE_FIELDS.join(', ')}`);
  }

  const lecture = await findOwnedLecture(req.params.id, req.user._id);
  Object.assign(lecture, updates);
  await lecture.save(); // save() runs the schema validators
  res.json({ success: true, data: lecture });
}

// Removes everything that belongs to the given lectures.
async function deleteLectureData(userId, lectureIds) {
  await Promise.all([
    Note.deleteMany({ user: userId, lecture: { $in: lectureIds } }),
    QuizAttempt.deleteMany({ user: userId, lecture: { $in: lectureIds } }),
    StudyProgress.updateOne({ user: userId }, { $pull: { flashcards: { lecture: { $in: lectureIds } } } })
  ]);
  await Lecture.deleteMany({ owner: userId, _id: { $in: lectureIds } });
}

// DELETE /api/lectures/:id
async function deleteLecture(req, res) {
  const lecture = await findOwnedLecture(req.params.id, req.user._id, '_id owner');
  await deleteLectureData(req.user._id, [lecture._id]);
  res.json({ success: true, data: { message: 'Lecture deleted', id: lecture.id } });
}

// DELETE /api/lectures
// Backs the existing "Reset demo data" footer button: clears the signed-in
// user's whole library (and only theirs).
async function deleteAllLectures(req, res) {
  const lectures = await Lecture.find({ owner: req.user._id }).select('_id');
  const ids = lectures.map((lecture) => lecture._id);
  await deleteLectureData(req.user._id, ids);
  res.json({ success: true, data: { message: 'Library cleared', deletedCount: ids.length } });
}

module.exports = { createLecture, listLectures, getLecture, updateLecture, deleteLecture, deleteAllLectures };
