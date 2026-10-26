const express = require('express');
const { importLocalData } = require('../controllers/migrationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/local-storage', protect, importLocalData);

module.exports = router;
