// An error we throw on purpose, carrying the HTTP status to send back.
// The error middleware turns it into a JSON response.
class AppError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional field-level details, e.g. { email: 'Invalid email' }
  }
}

module.exports = AppError;
