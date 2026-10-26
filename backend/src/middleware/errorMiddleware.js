const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

// Converts known error types into an AppError with the right status code.
function toAppError(err) {
  if (err instanceof AppError) return err;

  // express.json() could not parse the request body
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'Request body is too large');
  }

  // Schema validation failed, e.g. a required field is missing
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = {};
    Object.values(err.errors).forEach((fieldError) => {
      errors[fieldError.path] = fieldError.message;
    });
    return new AppError(400, 'Validation failed', errors);
  }

  // A value could not be converted to its schema type, e.g. a malformed ObjectId
  if (err instanceof mongoose.Error.CastError) {
    return new AppError(400, `Invalid value for ${err.path}`);
  }

  // Unique index violation (the only unique fields are user email and imported legacy ids)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).find((key) => key !== 'owner') || 'field';
    const message = field === 'email'
      ? 'An account with this email already exists'
      : `Duplicate value for ${field}`;
    return new AppError(409, message);
  }

  if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError') {
    return new AppError(503, 'Database is temporarily unavailable. Please try again shortly');
  }

  return null;
}

// Must keep all four parameters — that is how Express recognises error middleware.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const appError = toAppError(err);

  if (!appError) {
    // Unexpected bug: log the details on the server, but never send the stack trace to the client.
    console.error(err);
    return res.status(500).json({ success: false, message: 'Something went wrong on the server' });
  }

  const body = { success: false, message: appError.message };
  if (appError.errors) body.errors = appError.errors;
  return res.status(appError.statusCode).json(body);
}

module.exports = { errorHandler };
