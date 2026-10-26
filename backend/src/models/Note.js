const mongoose = require('mongoose');
const cleanJson = require('../utils/cleanJson');

const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
    text: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true,
      maxlength: [2000, 'A note can be at most 2000 characters']
    },
    // Position in the media (seconds) when the note was taken; clicking the
    // note in the UI seeks the player back to this moment.
    time: {
      type: Number,
      required: [true, 'Note time is required'],
      min: [0, 'Note time cannot be negative']
    }
  },
  {
    timestamps: true,
    toJSON: { transform: cleanJson }
  }
);

noteSchema.index({ lecture: 1, user: 1, createdAt: 1 });

module.exports = mongoose.model('Note', noteSchema);
