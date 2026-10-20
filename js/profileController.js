const mongoose = require('mongoose');
const Progress = require('../models/Progress');
const User = require('../models/User');

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id; // Retreived from JWT Auth Middleware

    // 1. Fetch User Base Info & Streak
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Perform MongoDB Aggregation for cumulative metrics
    const stats = await Progress.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalPodcasts: { $sum: 1 },
          totalListeningSeconds: { $sum: '$listeningTimeSeconds' },
          // Flatten quiz attempts array and count total elements
          totalQuizzes: { $sum: { $size: '$quizAttempts' } },
          // Collect all accuracies to compute master average
          quizAccuracies: { $push: '$quizAttempts.accuracy' },
          // Count total saved moments
          totalMoments: { $sum: { $size: '$savedMoments' } }
        }
      }
    ]);

    // Format aggregate calculations
    const rawStats = stats[0] || { totalPodcasts: 0, totalListeningSeconds: 0, totalQuizzes: 0, quizAccuracies: [], totalMoments: 0 };
    
    // Flatten nested arrays of accuracies to calculate average accuracy
    const allAccuracies = rawStats.quizAccuracies.flat();
    const averageAccuracy = allAccuracies.length > 0 
      ? Math.round(allAccuracies.reduce((sum, val) => sum + val, 0) / allAccuracies.length)
      : 0;

    // Convert seconds to clean UI reading format (e.g., "8h 42m")
    const hours = Math.floor(rawStats.totalListeningSeconds / 3600);
    const minutes = Math.round((rawStats.totalListeningSeconds % 3600) / 60);
    const listeningTimeFormatted = `${hours}h ${minutes}m`;

    // 3. Fetch Watched History with details of the Podcasts
    const watchedHistory = await Progress.find({ userId })
      .populate('podcastId', 'title durationSeconds thumbnail')
      .sort({ lastActive: -1 })
      .limit(5);

    // 4. Fetch all Personal Timestamp Notes
    const notes = await Progress.find({ userId, 'savedMoments.0': { $exists: true } })
      .populate('podcastId', 'title')
      .select('podcastId savedMoments')
      .lean();

    // Flatten notes and format them nicely for React render loops
    const formattedNotes = [];
    notes.forEach(session => {
      session.savedMoments.forEach(moment => {
        formattedNotes.push({
          noteId: moment._id,
          podcastId: session.podcastId._id,
          podcastTitle: session.podcastId.title,
          timestamp: moment.timestamp,
          noteText: moment.noteText,
          createdAt: moment.createdAt
        });
      });
    });
    // Sort notes by date added
    formattedNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        streak: user.streak || { current: 0, best: 0 }
      },
      metrics: {
        podcastsListened: rawStats.totalPodcasts,
        listeningTime: listeningTimeFormatted,
        quizzesCompleted: rawStats.totalQuizzes,
        quizAccuracy: `${averageAccuracy}%`,
        momentsSaved: rawStats.totalMoments
      },
      watchedHistory,
      personalNotes: formattedNotes
    });

  } catch (error) {
    console.error('Error in profile dashboard controller:', error);
    return res.status(500).json({ message: 'Internal server error processing profile metrics' });
  }
};
