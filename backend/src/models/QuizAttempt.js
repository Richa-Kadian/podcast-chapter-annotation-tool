const mongoose = require('mongoose');
const cleanJson = require('../utils/cleanJson');

// One answered question. The question itself is generated in the browser,
// so we keep a copy of its text and the moment in the lecture it came from —
// that is what powers "review the exact second you got wrong".
const answerSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, maxlength: 2000 },
    correctAnswer: { type: String, required: true, maxlength: 200 },
    selectedAnswer: { type: String, required: true, maxlength: 200 },
    isCorrect: { type: Boolean, required: true },
    timestamp: { type: Number, min: 0, default: 0 },
    chapter: { type: String, maxlength: 200 }
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 }
  },
  {
    // createdAt doubles as the attempt date
    timestamps: true,
    toJSON: { transform: cleanJson }
  }
);

quizAttemptSchema.index({ lecture: 1, user: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
