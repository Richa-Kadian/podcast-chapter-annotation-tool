const express = require('express');
const {
  createLecture,
  listLectures,
  getLecture,
  updateLecture,
  deleteLecture,
  deleteAllLectures
} = require('../controllers/lectureController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // every lecture route needs a signed-in user

router.route('/')
  .get(listLectures)
  .post(createLecture)
  .delete(deleteAllLectures);

router.route('/:id')
  .get(getLecture)
  .put(updateLecture)
  .delete(deleteLecture);

module.exports = router;
