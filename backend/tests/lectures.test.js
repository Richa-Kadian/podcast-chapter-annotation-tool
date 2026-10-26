const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signUpUser, sampleLecture, createLecture } = require('./helpers');
const Lecture = require('../src/models/Lecture');
const Note = require('../src/models/Note');

describe('Lecture API', () => {
  let server;
  let api;
  let owner;

  before(async () => {
    server = await startTestServer();
    api = server.api;
    owner = await signUpUser(api);
  });
  after(() => server.stop());

  it('creates a lecture owned by the signed-in user', async () => {
    const res = await api.post('/api/lectures').set('Authorization', owner.auth).send(sampleLecture());

    assert.equal(res.status, 201);
    assert.ok(res.body.data.id);
    assert.equal(res.body.data._id, undefined);
    assert.equal(res.body.data.title, 'Intro to JavaScript');
    assert.equal(res.body.data.lines.length, 3);
    assert.equal(res.body.data.bestScore, null);

    const saved = await Lecture.findById(res.body.data.id);
    assert.equal(saved.owner.toString(), owner.user.id);
  });

  it('ignores owner and bestScore sent by the client', async () => {
    const other = await signUpUser(api);
    const res = await api.post('/api/lectures').set('Authorization', owner.auth)
      .send(sampleLecture({ owner: other.user.id, bestScore: 100 }));

    assert.equal(res.status, 201);
    const saved = await Lecture.findById(res.body.data.id);
    assert.equal(saved.owner.toString(), owner.user.id);
    assert.equal(saved.bestScore, null);
  });

  it('stores a YouTube lecture with its video id', async () => {
    const res = await api.post('/api/lectures').set('Authorization', owner.auth)
      .send(sampleLecture({ type: 'youtube', ytId: 'dQw4w9WgXcQ', title: 'YouTube Lecture' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.ytId, 'dQw4w9WgXcQ');
  });

  it('rejects a lecture with missing or invalid fields', async () => {
    const res = await api.post('/api/lectures').set('Authorization', owner.auth)
      .send({ type: 'podcast', duration: -5 });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Validation failed');
    assert.ok(res.body.errors.title);
    assert.ok(res.body.errors.type);
    assert.ok(res.body.errors.duration);
  });

  it('rejects a YouTube lecture without a ytId', async () => {
    const res = await api.post('/api/lectures').set('Authorization', owner.auth)
      .send(sampleLecture({ type: 'youtube' }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.ytId);
  });

  it('lists only the user\'s own lectures, newest first, without transcripts', async () => {
    const other = await signUpUser(api);
    await createLecture(api, other.auth, { title: 'Someone else\'s lecture' });
    const newest = await createLecture(api, owner.auth, { title: 'Newest lecture' });

    const res = await api.get('/api/lectures').set('Authorization', owner.auth);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].id, newest.id);
    assert.ok(res.body.data.every((lecture) => lecture.title !== 'Someone else\'s lecture'));
    assert.equal(res.body.data[0].lines, undefined);
    assert.equal(res.body.data[0].chapters.length, 2);
  });

  it('gets one lecture with its full transcript', async () => {
    const lecture = await createLecture(api, owner.auth);
    const res = await api.get(`/api/lectures/${lecture.id}`).set('Authorization', owner.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lines.length, 3);
  });

  it('returns 400 for a malformed id and 404 for a missing lecture', async () => {
    const malformed = await api.get('/api/lectures/not-a-real-id').set('Authorization', owner.auth);
    assert.equal(malformed.status, 400);

    const missing = await api.get('/api/lectures/507f1f77bcf86cd799439011').set('Authorization', owner.auth);
    assert.equal(missing.status, 404);
  });

  it('updates the title, duration and transcript', async () => {
    const lecture = await createLecture(api, owner.auth);
    const res = await api.put(`/api/lectures/${lecture.id}`).set('Authorization', owner.auth).send({
      title: 'Renamed lecture',
      duration: 600,
      lines: [{ start: 0, end: 600, speaker: 'Prof. Miller', text: 'One long sentence.', keyword: 'variables' }]
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Renamed lecture');
    assert.equal(res.body.data.duration, 600);

    const saved = await Lecture.findById(lecture.id);
    assert.equal(saved.lines.length, 1);
  });

  it('rejects an update with no allowed fields and an invalid update', async () => {
    const lecture = await createLecture(api, owner.auth);

    const empty = await api.put(`/api/lectures/${lecture.id}`).set('Authorization', owner.auth).send({ bestScore: 100 });
    assert.equal(empty.status, 400);

    const invalid = await api.put(`/api/lectures/${lecture.id}`).set('Authorization', owner.auth).send({ duration: 'long' });
    assert.equal(invalid.status, 400);
  });

  it('deletes a lecture together with its notes', async () => {
    const lecture = await createLecture(api, owner.auth);
    await api.post(`/api/lectures/${lecture.id}/notes`).set('Authorization', owner.auth).send({ text: 'Remember this', time: 12 });

    const res = await api.delete(`/api/lectures/${lecture.id}`).set('Authorization', owner.auth);
    assert.equal(res.status, 200);

    assert.equal(await Lecture.exists({ _id: lecture.id }), null);
    assert.equal(await Note.countDocuments({ lecture: lecture.id }), 0);

    const again = await api.get(`/api/lectures/${lecture.id}`).set('Authorization', owner.auth);
    assert.equal(again.status, 404);
  });

  it('DELETE /api/lectures clears only the signed-in user\'s library', async () => {
    const userA = await signUpUser(api);
    const userB = await signUpUser(api);
    await createLecture(api, userA.auth);
    await createLecture(api, userA.auth);
    await createLecture(api, userB.auth);

    const res = await api.delete('/api/lectures').set('Authorization', userA.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deletedCount, 2);
    assert.equal(await Lecture.countDocuments({ owner: userA.user.id }), 0);
    assert.equal(await Lecture.countDocuments({ owner: userB.user.id }), 1);
  });
});
