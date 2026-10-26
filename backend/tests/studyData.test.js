const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signUpUser, createLecture } = require('./helpers');
const Note = require('../src/models/Note');
const QuizAttempt = require('../src/models/QuizAttempt');
const StudyProgress = require('../src/models/StudyProgress');
const Lecture = require('../src/models/Lecture');
const { recordStudyDay, getActiveStreak } = require('../src/services/streakService');

const answer = (selectedAnswer, correctAnswer = 'variables') => ({
  question: 'Fill in the blank: "__________ hold references in memory."',
  correctAnswer,
  selectedAnswer,
  timestamp: 0,
  chapter: 'Variables & Data References'
});

describe('Notes API', () => {
  let server;
  let api;
  let owner;
  let lecture;

  before(async () => {
    server = await startTestServer();
    api = server.api;
    owner = await signUpUser(api);
    lecture = await createLecture(api, owner.auth);
  });
  after(() => server.stop());

  it('creates and lists timestamped notes in the order they were taken', async () => {
    const first = await api.post(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth)
      .send({ text: 'Closures keep outer variables alive', time: 42.5 });
    await api.post(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth)
      .send({ text: 'Review arrow functions', time: 10 });

    assert.equal(first.status, 201);
    assert.equal(first.body.data.time, 42.5);

    const list = await api.get(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((note) => note.text), ['Closures keep outer variables alive', 'Review arrow functions']);

    assert.equal(await Note.countDocuments({ lecture: lecture.id }), 2);
  });

  it('rejects an empty note and a negative time', async () => {
    const empty = await api.post(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth).send({ text: '   ', time: 3 });
    assert.equal(empty.status, 400);

    const negative = await api.post(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth).send({ text: 'Hi', time: -1 });
    assert.equal(negative.status, 400);
  });

  it('updates and deletes a note', async () => {
    const created = await api.post(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth)
      .send({ text: 'Draft', time: 5 });
    const noteId = created.body.data.id;

    const updated = await api.put(`/api/notes/${noteId}`).set('Authorization', owner.auth).send({ text: 'Final' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.text, 'Final');

    const deleted = await api.delete(`/api/notes/${noteId}`).set('Authorization', owner.auth);
    assert.equal(deleted.status, 200);
    assert.equal(await Note.exists({ _id: noteId }), null);
  });
});

describe('Quiz attempts API', () => {
  let server;
  let api;
  let owner;
  let lecture;

  before(async () => {
    server = await startTestServer();
    api = server.api;
    owner = await signUpUser(api);
    lecture = await createLecture(api, owner.auth);
  });
  after(() => server.stop());

  it('grades the attempt on the server and stores it', async () => {
    const res = await api.post(`/api/lectures/${lecture.id}/quiz-attempts`).set('Authorization', owner.auth).send({
      answers: [answer('variables'), answer('Variables'), answer('arrays'), answer('dom')],
      // a client-sent score must be ignored
      score: 4,
      percentage: 100
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.attempt.score, 2);
    assert.equal(res.body.data.attempt.totalQuestions, 4);
    assert.equal(res.body.data.attempt.percentage, 50);
    assert.equal(res.body.data.attempt.answers[2].isCorrect, false);
    assert.equal(res.body.data.bestScore, 50);

    assert.equal(await QuizAttempt.countDocuments({ lecture: lecture.id }), 1);
  });

  it('keeps the best score and starts the streak on a passing attempt', async () => {
    const pass = await api.post(`/api/lectures/${lecture.id}/quiz-attempts`).set('Authorization', owner.auth)
      .send({ answers: [answer('variables'), answer('variables'), answer('variables'), answer('dom')] });
    assert.equal(pass.body.data.bestScore, 75);
    assert.equal(pass.body.data.streak.current, 1);
    assert.equal(pass.body.data.streak.best, 1);

    // A worse attempt the same day changes neither the best score nor the streak
    const worse = await api.post(`/api/lectures/${lecture.id}/quiz-attempts`).set('Authorization', owner.auth)
      .send({ answers: [answer('dom')] });
    assert.equal(worse.body.data.bestScore, 75);
    assert.equal(worse.body.data.streak.current, 1);

    const saved = await Lecture.findById(lecture.id);
    assert.equal(saved.bestScore, 75);
  });

  it('lists attempts newest first', async () => {
    const res = await api.get(`/api/lectures/${lecture.id}/quiz-attempts`).set('Authorization', owner.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.data[0].percentage, 0);
  });

  it('rejects an attempt without answers', async () => {
    const res = await api.post(`/api/lectures/${lecture.id}/quiz-attempts`).set('Authorization', owner.auth).send({ answers: [] });
    assert.equal(res.status, 400);

    const badItem = await api.post(`/api/lectures/${lecture.id}/quiz-attempts`).set('Authorization', owner.auth)
      .send({ answers: [{ question: 'Q?' }] });
    assert.equal(badItem.status, 400);
  });
});

describe('Study progress API', () => {
  let server;
  let api;
  let owner;
  let lecture;

  before(async () => {
    server = await startTestServer();
    api = server.api;
    owner = await signUpUser(api);
    lecture = await createLecture(api, owner.auth);
  });
  after(() => server.stop());

  it('starts with an empty streak', async () => {
    const res = await api.get('/api/progress').set('Authorization', owner.auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.streak, { current: 0, best: 0, lastDate: null });
  });

  it('saves and reloads flashcard piles for a lecture', async () => {
    const save = await api.put(`/api/progress/flashcards/${lecture.id}`).set('Authorization', owner.auth)
      .send({ known: ['fc_0', 'fc_1', 'fc_1'], studying: ['fc_2'] });
    assert.equal(save.status, 200);
    assert.deepEqual(save.body.data.known, ['fc_0', 'fc_1']);

    const load = await api.get(`/api/progress/flashcards/${lecture.id}`).set('Authorization', owner.auth);
    assert.deepEqual(load.body.data.known, ['fc_0', 'fc_1']);
    assert.deepEqual(load.body.data.studying, ['fc_2']);

    const progress = await StudyProgress.findOne({ user: owner.user.id });
    assert.equal(progress.flashcards.length, 1);
  });

  it('rejects a card that is in both piles', async () => {
    const res = await api.put(`/api/progress/flashcards/${lecture.id}`).set('Authorization', owner.auth)
      .send({ known: ['fc_0'], studying: ['fc_0'] });
    assert.equal(res.status, 400);
  });

  it('resets progress', async () => {
    const res = await api.delete('/api/progress').set('Authorization', owner.auth);
    assert.equal(res.status, 200);
    const load = await api.get(`/api/progress/flashcards/${lecture.id}`).set('Authorization', owner.auth);
    assert.deepEqual(load.body.data.known, []);
  });
});

describe('Streak rules', () => {
  const day = (iso) => new Date(`${iso}T12:00:00Z`);

  it('extends the streak on consecutive days and restarts it after a gap', () => {
    const progress = { currentStreak: 0, bestStreak: 0, lastStudyDate: null };

    recordStudyDay(progress, 80, day('2026-10-01'));
    recordStudyDay(progress, 90, day('2026-10-01')); // same day, counted once
    recordStudyDay(progress, 70, day('2026-10-02'));
    assert.equal(progress.currentStreak, 2);

    recordStudyDay(progress, 40, day('2026-10-03')); // below 60% does not count
    assert.equal(progress.currentStreak, 2);

    recordStudyDay(progress, 100, day('2026-10-05')); // missed a day
    assert.equal(progress.currentStreak, 1);
    assert.equal(progress.bestStreak, 2);
  });

  it('reports a streak as 0 once a whole day has been missed', () => {
    const progress = { currentStreak: 3, bestStreak: 3, lastStudyDate: day('2026-10-01') };
    assert.equal(getActiveStreak(progress, day('2026-10-02')), 3);
    assert.equal(getActiveStreak(progress, day('2026-10-03')), 0);
  });
});
