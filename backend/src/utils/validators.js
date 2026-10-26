// Same rules the signup form already enforces in frontend/js/login.js,
// repeated here because the server must never trust the browser.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>]/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /\d/.test(password)
    && SPECIAL_CHAR_RE.test(password);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = { EMAIL_RE, normalizeEmail, isValidEmail, isStrongPassword, isNonEmptyString };
