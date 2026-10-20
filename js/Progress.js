const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  podcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Podcast', required: true },
  listeningTimeSeconds: { type: Number, default: 0 }, // Accumulated playback duration
  lastPositionSeconds: { type: Number, default: 0 }, // Resumable timeline position
  isCompleted: { type: Boolean, default: false },
  quizAttempts: [{
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    accuracy: { type: Number, required: true }, // (score/total)*100
    attemptedAt: { type: Date, default: Date.now }
  }],
  savedMoments: [{
    timestamp: { type: Number, required: true },
    noteText: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for high performance retrieval
ProgressSchema.index({ userId: 1, podcastId: 1 });

module.exports = mongoose.model('Progress', ProgressSchema);
