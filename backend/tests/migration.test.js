const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signUpUser, sampleLecture } = require('./helpers');
const Lecture = require('../src/models/Lecture');
const Note = require('../src/models/Note');
const StudyProgress = require('../src/models/StudyProgress');

// Shaped like an entry of the old momento_library_v1__<userId> LocalStorage key
function legacySession(legacyId, overrides = {}) {
  return {
    ...sampleLecture(),
    legacyId,
    bestScore: 80,
    notes: [{ id: 'm_note1', time: 12.3, text: 'Old note', createdAt: '2026-08-01T10:00:00.000Z' }],
    flashcards: { known: ['fc_0'], studying: ['fc_1'] },
    ...overrides
  };
}

describe('LocalStorage migration API', () => {
  let server;
  let api;
  let owner;

  before(async () => {
    server = await startTestServer();
    api = server.api;
    owner = await signUpUser(api);
  });
  after(() => server.stop());

  it('imports valid sessions with notes, flashcards and streak, and reports invalid ones', async () => {
    const res = await api.post('/api/migration/local-storage').set('Authorization', owner.auth).send({
      lectures: [
        legacySession('m_abc123'),
        legacySession('m_bad', { type: 'cassette', duration: -1 }),
        { title: 'No id' }
      ],
      streak: { current: 3, best: 5, lastDate: 'Mon Oct 26 2026' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.imported, 1);
    assert.equal(res.body.data.failed.length, 2);
    assert.equal(res.body.data.failed[0].legacyId, 'm_bad');
    assert.equal(res.body.data.streakImported, true);

    const lecture = await Lecture.findOne({ owner: owner.user.id, legacyId: 'm_abc123' });
    assert.equal(lecture.bestScore, 80);
    assert.equal(await Note.countDocuments({ lecture: lecture._id }), 1);

    const progress = await StudyProgress.findOne({ user: owner.user.id });
    assert.equal(progress.bestStreak, 5);
    assert.deepEqual([...progress.flashcards[0].known], ['fc_0']);
  });

  it('skips sessions that were already imported and never overwrites the streak', async () => {
    const res = await api.post('/api/migration/local-storage').set('Authorization', owner.auth).send({
      lectures: [legacySession('m_abc123')],
      streak: { current: 99, best: 99 }
    });

    assert.equal(res.body.data.imported, 0);
    assert.equal(res.body.data.skipped, 1);
    assert.equal(res.body.data.streakImported, false);
    assert.equal(await Lecture.countDocuments({ owner: owner.user.id }), 1);

    const progress = await StudyProgress.findOne({ user: owner.user.id });
    assert.equal(progress.bestStreak, 5);
  });

  it('assigns imported records to the signed-in user, not to an owner in the payload', async () => {
    const other = await signUpUser(api);
    await api.post('/api/migration/local-storage').set('Authorization', owner.auth)
      .send({ lectures: [legacySession('m_owner_test', { owner: other.user.id })] });

    const lecture = await Lecture.findOne({ legacyId: 'm_owner_test' });
    assert.equal(lecture.owner.toString(), owner.user.id);
  });

  it('rejects a payload where lectures is not an array', async () => {
    const res = await api.post('/api/migration/local-storage').set('Authorization', owner.auth).send({ lectures: 'all of them' });
    assert.equal(res.status, 400);
  });
});
