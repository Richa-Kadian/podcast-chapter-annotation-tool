// Entry point: check the config, connect to MongoDB, then start listening.
const { config, validateConfig } = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function start() {
  try {
    validateConfig();
    await connectDatabase(config.mongodbUri);
  } catch (err) {
    console.error(`Could not start the server: ${err.message}`);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Momento API listening on port ${config.port} (${config.nodeEnv})`);
  });

  // Close connections cleanly when the host stops or restarts the app.
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
