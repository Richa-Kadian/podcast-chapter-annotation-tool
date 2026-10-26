const QuizAttempt = require('../models/QuizAttempt');
const StudyProgress = require('../models/StudyProgress');
const AppError = require('../utils/AppError');
const { findOwnedLecture } = require('../services/lectureAccess');
const { recordStudyDay, toStreakResponse } = require('../services/streakService');
const { isNonEmptyString } = require('../utils/validators');

const MAX_QUESTIONS = 100;

// Checks each answered question and works out isCorrect on the server,
// instead of trusting a score sent by the browser.
function gradeAnswers(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new AppError(400, 'answers must be a non-empty array');
  }
  if (answers.length > MAX_QUESTIONS) {
    throw new AppError(400, `A quiz can have at most ${MAX_QUESTIONS} questions`);
  }

  return answers.map((answer, index) => {
    const { question, correctAnswer, selectedAnswer, timestamp, chapter } = answer || {};
    if (!isNonEmptyString(question) || !isNonEmptyString(correctAnswer) || !isNonEmptyString(selectedAnswer)) {
      throw new AppError(400, `Answer ${index + 1} needs question, correctAnswer and selectedAnswer`);
    }
    return {
      question,
      correctAnswer,
      selectedAnswer,
      isCorrect: selectedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase(),
      timestamp: Number(timestamp) || 0,
      chapter: typeof chapter === 'string' ? chapter : undefined
    };
  });
}

// POST /api/lectures/:lectureId/quiz-attempts
// Saves the attempt, updates the lecture's best score and the daily streak.
async function createQuizAttempt(req, res) {
  const lecture = await findOwnedLecture(req.params.lectureId, req.user._id);
  const gradedAnswers = gradeAnswers((req.body || {}).answers);

  const score = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const totalQuestions = gradedAnswers.length;
  const percentage = Math.round((score / totalQuestions) * 100);

  const attempt = await QuizAttempt.create({
    user: req.user._id,
    lecture: lecture._id,
    answers: gradedAnswers,
    score,
    totalQuestions,
    percentage
  });

  if (lecture.bestScore === null || lecture.bestScore === undefined || percentage > lecture.bestScore) {
    lecture.bestScore = percentage;
    await lecture.save();
  }

  const progress = await StudyProgress.findOrCreateForUser(req.user._id);
  if (recordStudyDay(progress, percentage)) {
    await progress.save();
  }

  res.status(201).json({
    success: true,
    data: {
      attempt,
      bestScore: lecture.bestScore,
      streak: toStreakResponse(progress)
    }
  });
}

// GET /api/lectures/:lectureId/quiz-attempts
async function listQuizAttempts(req, res) {
  const lecture = await findOwnedLecture(req.params.lectureId, req.user._id, '_id owner');
  const attempts = await QuizAttempt.find({ lecture: lecture._id, user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: attempts });
}

module.exports = { createQuizAttempt, listQuizAttempts, gradeAnswers };
