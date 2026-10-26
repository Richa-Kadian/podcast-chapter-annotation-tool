const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signUpUser } = require('./helpers');
const User = require('../src/models/User');

describe('Authentication API', () => {
  let server;
  let api;

  before(async () => {
    server = await startTestServer();
    api = server.api;
  });
  after(() => server.stop());

  it('GET /api/health reports the database as connected', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.body.data.database, 'connected');
    assert.equal(JSON.stringify(res.body).includes('mongodb://'), false);
  });

  it('signup creates a user, hashes the password and never returns it', async () => {
    const res = await api.post('/api/auth/signup').send({
      name: 'Aditi Sharma',
      email: '  Aditi@Example.COM ',
      password: 'Secret#123'
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.email, 'aditi@example.com');
    assert.equal(res.body.data.user.password, undefined);
    assert.equal(res.body.data.user.tokenVersion, undefined);

    const saved = await User.findOne({ email: 'aditi@example.com' }).select('+password');
    assert.ok(saved, 'user should exist in MongoDB');
    assert.notEqual(saved.password, 'Secret#123');
    assert.match(saved.password, /^\$2[aby]\$10\$/, 'password should be a bcrypt hash');
  });

  it('rejects a duplicate email with 409, even with different casing', async () => {
    const res = await api.post('/api/auth/signup').send({
      name: 'Someone Else',
      email: 'ADITI@example.com',
      password: 'Another#456'
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already exists/);
  });

  it('rejects invalid signup fields with 400 and per-field errors', async () => {
    const res = await api.post('/api/auth/signup').send({ name: 'A', email: 'not-an-email', password: 'short' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.name);
    assert.ok(res.body.errors.email);
    assert.ok(res.body.errors.password);
  });

  it('logs in with valid credentials', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'aditi@example.com', password: 'Secret#123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.name, 'Aditi Sharma');
  });

  it('rejects a wrong password and an unknown email with the same 401 message', async () => {
    const wrongPassword = await api.post('/api/auth/login').send({ email: 'aditi@example.com', password: 'Wrong#999' });
    const unknownEmail = await api.post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Secret#123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });

  it('no longer lets an email containing "demo" log in without a password check', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'demo@example.com', password: 'anything' });
    assert.equal(res.status, 401);
  });

  it('rejects login without email or password with 400', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'aditi@example.com' });
    assert.equal(res.status, 400);
  });

  it('GET /api/auth/me returns the signed-in user', async () => {
    const { auth, user } = await signUpUser(api);
    const res = await api.get('/api/auth/me').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, user.id);
  });

  it('GET /api/auth/me without a token returns 401', async () => {
    const res = await api.get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('rejects a tampered token with 401', async () => {
    const { token } = await signUpUser(api);
    const tampered = `${token.slice(0, -4)}abcd`;
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${tampered}`);
    assert.equal(res.status, 401);
  });

  it('logout invalidates the token that was used', async () => {
    const { auth } = await signUpUser(api);
    const logoutRes = await api.post('/api/auth/logout').set('Authorization', auth);
    assert.equal(logoutRes.status, 200);

    const meRes = await api.get('/api/auth/me').set('Authorization', auth);
    assert.equal(meRes.status, 401);
  });

  it('demo login signs into one dedicated demo account', async () => {
    const first = await api.post('/api/auth/demo');
    const second = await api.post('/api/auth/demo');
    assert.equal(first.status, 200);
    assert.equal(first.body.data.user.email, 'student@momento.ai');
    assert.equal(first.body.data.user.isDemo, true);
    assert.equal(first.body.data.user.id, second.body.data.user.id);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await api
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken"');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Request body is not valid JSON');
  });

  it('returns 404 JSON for an unknown route', async () => {
    const res = await api.get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});
