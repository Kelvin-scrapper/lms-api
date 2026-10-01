const express = require('express');
const { authenticate } = require('../middleware/auth');
const learning = require('../controllers/learningController');

const router = express.Router();

router.use(authenticate);

router.get('/', learning.myLearning);
router.put('/lessons/:lessonId/complete', learning.markComplete);
router.delete('/lessons/:lessonId/complete', learning.unmarkComplete);

module.exports = router;
