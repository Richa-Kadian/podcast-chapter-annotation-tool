const mongoose = require('mongoose');
const Lecture = require('../models/Lecture');
const AppError = require('../utils/AppError');

// Loads a lecture and makes sure it belongs to the signed-in user.
// Notes, quiz attempts and flashcards all go through this check, so a user
// can never reach another user's data just by guessing a lecture id.
//   invalid id format -> 400, no such lecture -> 404, someone else's -> 403
async function findOwnedLecture(lectureId, userId, projection) {
  if (!mongoose.isValidObjectId(lectureId)) {
    throw new AppError(400, 'Invalid lecture id');
  }

  const lecture = await Lecture.findById(lectureId, projection);
  if (!lecture) {
    throw new AppError(404, 'Lecture not found');
  }
  if (!lecture.owner.equals(userId)) {
    throw new AppError(403, 'You do not have permission to access this lecture');
  }
  return lecture;
}

module.exports = { findOwnedLecture };
