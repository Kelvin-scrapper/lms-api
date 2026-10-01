const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const stats = require('../controllers/statsController');

const router = express.Router();

router.get('/', authenticate, requireRole('ADMIN'), stats.summary);

module.exports = router;
