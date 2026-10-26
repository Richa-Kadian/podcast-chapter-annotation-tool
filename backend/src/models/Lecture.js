const mongoose = require('mongoose');
const cleanJson = require('../utils/cleanJson');

// One sentence of the transcript. Mirrors the objects built by
// generateTranscript() in frontend/js/app.js.
const transcriptLineSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true, min: 0 },
    end: { type: Number, required: true, min: 0 },
    speaker: { type: String, trim: true, maxlength: 100 },
    text: { type: String, required: true, maxlength: 2000 },
    keyword: { type: String, trim: true, maxlength: 100 }
  },
  { _id: false }
);

// One detected chapter. Mirrors detectChapters() in frontend/js/app.js.
const chapterSchema = new mongoose.Schema(
  {
    startIndex: { type: Number, min: 0 },
    startTime: { type: Number, required: true, min: 0 },
    endTime: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    keyword: { type: String, trim: true, maxlength: 100 }
  },
  { _id: false }
);

const lectureSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Lecture title is required'],
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters']
    },
    // "video" / "audio" = a local file chosen in the browser (not uploaded),
    // "youtube" = a YouTube link. A direct .mp4/.webm link is also "video".
    type: {
      type: String,
      enum: { values: ['video', 'audio', 'youtube'], message: 'Type must be video, audio or youtube' },
      required: [true, 'Media type is required']
    },
    ytId: {
      type: String,
      match: [/^[A-Za-z0-9_-]{6,20}$/, 'Invalid YouTube video id'],
      required: [function requiresYtId() { return this.type === 'youtube'; }, 'YouTube lectures need a ytId']
    },
    // Only set for direct video links (https://.../lecture.mp4). Local files are
    // played from a temporary browser URL that is never sent to the server.
    mediaUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      match: [/^https?:\/\//i, 'Media URL must start with http:// or https://']
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [0, 'Duration cannot be negative']
    },
    genre: { type: String, trim: true, maxlength: 60 },
    lines: {
      type: [transcriptLineSchema],
      default: [],
      validate: [(lines) => lines.length <= 5000, 'A transcript can have at most 5000 lines']
    },
    chapters: {
      type: [chapterSchema],
      default: [],
      validate: [(chapters) => chapters.length <= 500, 'A lecture can have at most 500 chapters']
    },
    // Highest quiz percentage so far. Only the quiz controller changes this.
    bestScore: { type: Number, min: 0, max: 100, default: null },
    // The old LocalStorage session id, kept only for lectures imported from
    // the browser, so the same session can't be imported twice.
    legacyId: { type: String, maxlength: 100 }
  },
  {
    timestamps: true,
    toJSON: { transform: cleanJson }
  }
);

lectureSchema.index({ owner: 1, createdAt: -1 });
lectureSchema.index(
  { owner: 1, legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } }
);

module.exports = mongoose.model('Lecture', lectureSchema);
