const express = require('express');
const files = require('../controllers/filesController');

const router = express.Router();

// Public, like Blob URLs: resource links are embedded directly in lesson pages.
router.get('/:key', files.serve);

module.exports = router;
