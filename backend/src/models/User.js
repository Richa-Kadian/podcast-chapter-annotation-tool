const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cleanJson = require('../utils/cleanJson');
const { EMAIL_RE } = require('../utils/validators');

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_RE, 'Please enter a valid email address']
    },
    // Always a bcrypt hash (see the pre-save hook). select:false means it is
    // never loaded unless a query explicitly asks for it with .select('+password').
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    // Stored inside every JWT. Logging out increments it, which makes all
    // previously issued tokens for this user invalid.
    tokenVersion: {
      type: Number,
      default: 0,
      select: false
    },
    isDemo: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        cleanJson(doc, ret);
        delete ret.password;
        delete ret.tokenVersion;
        return ret;
      }
    }
  }
);

// Hash the password whenever it is set or changed, so plain text never reaches the database.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
