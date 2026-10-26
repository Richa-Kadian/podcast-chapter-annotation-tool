const mongoose = require('mongoose');

async function connectDatabase(uri) {
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

  // Give up after 10s instead of hanging forever if Atlas is unreachable
  // (wrong URI, IP not on the Atlas access list, etc.).
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

// readyState 1 means "connected" — used by the health check.
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected };
