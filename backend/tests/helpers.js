// Shared setup for the automated tests. Each test file starts its own
// in-memory MongoDB server (a real mongod binary, downloaded once by
// mongodb-memory-server) so tests never touch a real database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_EMAIL = 'student@momento.ai';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');

async function startTestServer() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await mongoose.connection.syncIndexes();

  const api = request(createApp());

  return {
    api,
    async reset() {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.syncIndexes();
    },
    async stop() {
      await mongoose.disconnect();
      await mongo.stop();
    }
  };
}

let userCounter = 0;

// Signs up a fresh user and returns { token, user, auth } where auth is the
// header value to pass to .set('Authorization', auth).
async function signUpUser(api, overrides = {}) {
  userCounter += 1;
  const body = {
    name: 'Test Student',
    email: `student${userCounter}@example.com`,
    password: 'Secret#123',
    ...overrides
  };
  const res = await api.post('/api/auth/signup').send(body);
  if (res.status !== 201) {
    throw new Error(`Signup failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...res.body.data, auth: `Bearer ${res.body.data.token}`, password: body.password };
}

// A small lecture shaped like the sessions frontend/js/app.js creates.
function sampleLecture(overrides = {}) {
  return {
    title: 'Intro to JavaScript',
    type: 'video',
    duration: 120,
    genre: 'Lecture Study',
    lines: [
      { start: 0, end: 30, speaker: 'Prof. Miller', text: 'Variables hold references in memory.', keyword: 'variables' },
      { start: 30, end: 60, speaker: 'Dr. Aris', text: 'Functions are first-class citizens.', keyword: 'functions' },
      { start: 60, end: 120, speaker: 'TA Alex', text: 'Arrays are dynamic sequences.', keyword: 'arrays' }
    ],
    chapters: [
      { startIndex: 0, startTime: 0, endTime: 60, title: 'Variables & Data References', keyword: 'variables' },
      { startIndex: 2, startTime: 60, endTime: 120, title: 'Array Methods & Iteration', keyword: 'arrays' }
    ],
    ...overrides
  };
}

async function createLecture(api, auth, overrides) {
  const res = await api.post('/api/lectures').set('Authorization', auth).send(sampleLecture(overrides));
  if (res.status !== 201) {
    throw new Error(`Lecture creation failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

module.exports = { startTestServer, signUpUser, sampleLecture, createLecture };
