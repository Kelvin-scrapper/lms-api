const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../schemas/courses');
const enrollments = require('../controllers/enrollmentsController');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', enrollments.list);
router.post('/', validate(schemas.enroll), enrollments.create);

module.exports = router;
