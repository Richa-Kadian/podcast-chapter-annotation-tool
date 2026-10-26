// Daily study streak rules (moved here from recordStreak() in the old frontend):
//   - only a quiz score of PASSING_SCORE% or more counts as studying
//   - several passing quizzes on the same day count once
//   - passing on the day right after the last study day extends the streak
//   - missing a day starts a new streak at 1
// Days are compared as UTC calendar dates (YYYY-MM-DD).
const PASSING_SCORE = 60;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Updates the progress document in place. Returns true if anything changed.
function recordStudyDay(progress, percentage, now = new Date()) {
  if (percentage < PASSING_SCORE) return false;

  const today = toDayKey(now);
  const yesterday = toDayKey(now.getTime() - ONE_DAY_MS);
  const lastDay = progress.lastStudyDate ? toDayKey(progress.lastStudyDate) : null;

  if (lastDay === today) return false;

  progress.currentStreak = lastDay === yesterday ? progress.currentStreak + 1 : 1;
  progress.bestStreak = Math.max(progress.bestStreak, progress.currentStreak);
  progress.lastStudyDate = now;
  return true;
}

// The stored currentStreak only changes when a quiz is taken, so if the user
// has skipped a day since then, the streak they actually have now is 0.
function getActiveStreak(progress, now = new Date()) {
  if (!progress.lastStudyDate) return 0;
  const lastDay = toDayKey(progress.lastStudyDate);
  const today = toDayKey(now);
  const yesterday = toDayKey(now.getTime() - ONE_DAY_MS);
  return lastDay === today || lastDay === yesterday ? progress.currentStreak : 0;
}

// Shape the frontend displays: { current, best, lastDate }
function toStreakResponse(progress) {
  return {
    current: getActiveStreak(progress),
    best: progress.bestStreak,
    lastDate: progress.lastStudyDate
  };
}

module.exports = { PASSING_SCORE, recordStudyDay, getActiveStreak, toStreakResponse };
