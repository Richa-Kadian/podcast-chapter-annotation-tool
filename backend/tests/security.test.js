// Checks that private data is protected: no token -> 401,
// another user's lecture or note -> 403, and nothing is changed.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signUpUser, createLecture } = require('./helpers');
const Lecture = require('../src/models/Lecture');
const Note = require('../src/models/Note');

describe('Authorization and ownership checks', () => {
  let server;
  let api;
  let alice;
  let bob;
  let aliceLecture;
  let aliceNote;

  before(async () => {
    server = await startTestServer();
    api = server.api;
    alice = await signUpUser(api, { name: 'Alice' });
    bob = await signUpUser(api, { name: 'Bob' });
    aliceLecture = await createLecture(api, alice.auth, { title: 'Alice private lecture' });
    const noteRes = await api.post(`/api/lectures/${aliceLecture.id}/notes`).set('Authorization', alice.auth)
      .send({ text: 'Alice private note', time: 1 });
    aliceNote = noteRes.body.data;
  });
  after(() => server.stop());

  const protectedRequests = [
    ['get', '/api/lectures'],
    ['post', '/api/lectures'],
    ['delete', '/api/lectures'],
    ['get', '/api/progress'],
    ['post', '/api/migration/local-storage'],
    ['post', '/api/auth/logout']
  ];

  protectedRequests.forEach(([method, path]) => {
    it(`${method.toUpperCase()} ${path} without a token returns 401`, async () => {
      const res = await api[method](path);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const res = await api.get('/api/lectures').set('Authorization', `Basic ${alice.token}`);
    assert.equal(res.status, 401);
  });

  it('Bob cannot read Alice\'s lecture (403)', async () => {
    const res = await api.get(`/api/lectures/${aliceLecture.id}`).set('Authorization', bob.auth);
    assert.equal(res.status, 403);
    assert.equal(JSON.stringify(res.body).includes('Alice private lecture'), false);
  });

  it('Bob cannot update or delete Alice\'s lecture (403) and it stays unchanged', async () => {
    const update = await api.put(`/api/lectures/${aliceLecture.id}`).set('Authorization', bob.auth).send({ title: 'Hacked' });
    const remove = await api.delete(`/api/lectures/${aliceLecture.id}`).set('Authorization', bob.auth);

    assert.equal(update.status, 403);
    assert.equal(remove.status, 403);
    const saved = await Lecture.findById(aliceLecture.id);
    assert.equal(saved.title, 'Alice private lecture');
  });

  it('Bob cannot read or add notes on Alice\'s lecture (403)', async () => {
    const list = await api.get(`/api/lectures/${aliceLecture.id}/notes`).set('Authorization', bob.auth);
    const add = await api.post(`/api/lectures/${aliceLecture.id}/notes`).set('Authorization', bob.auth).send({ text: 'x', time: 0 });
    assert.equal(list.status, 403);
    assert.equal(add.status, 403);
  });

  it('Bob cannot edit or delete Alice\'s note (403)', async () => {
    const update = await api.put(`/api/notes/${aliceNote.id}`).set('Authorization', bob.auth).send({ text: 'Hacked' });
    const remove = await api.delete(`/api/notes/${aliceNote.id}`).set('Authorization', bob.auth);
    assert.equal(update.status, 403);
    assert.equal(remove.status, 403);
    const saved = await Note.findById(aliceNote.id);
    assert.equal(saved.text, 'Alice private note');
  });

  it('Bob cannot record quiz attempts or flashcards on Alice\'s lecture (403)', async () => {
    const quiz = await api.post(`/api/lectures/${aliceLecture.id}/quiz-attempts`).set('Authorization', bob.auth)
      .send({ answers: [{ question: 'Q', correctAnswer: 'a', selectedAnswer: 'a' }] });
    const cards = await api.put(`/api/progress/flashcards/${aliceLecture.id}`).set('Authorization', bob.auth)
      .send({ known: [], studying: [] });
    assert.equal(quiz.status, 403);
    assert.equal(cards.status, 403);
  });

  it('Bob\'s "delete all" does not touch Alice\'s lectures', async () => {
    await api.delete('/api/lectures').set('Authorization', bob.auth);
    assert.ok(await Lecture.exists({ _id: aliceLecture.id }));
  });

  it('blocks browser requests from an unknown origin in CORS', async () => {
    const res = await api.get('/api/health').set('Origin', 'https://evil.example.com');
    assert.equal(res.headers['access-control-allow-origin'], undefined);

    const local = await api.get('/api/health').set('Origin', 'http://localhost:5500');
    assert.equal(local.headers['access-control-allow-origin'], 'http://localhost:5500');
  });
});
