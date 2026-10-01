const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../schemas/courses');
const courses = require('../controllers/coursesController');

const router = express.Router();

router.use(authenticate);

router.get('/', courses.list);
router.get('/:slug', courses.detail);
router.post('/:id/enroll', courses.enroll);
router.post('/:id/instructors', requireRole('ADMIN'), validate(schemas.assignInstructor), courses.addInstructor);
router.delete('/:id/instructors/:userId', requireRole('ADMIN'), courses.removeInstructor);

module.exports = router;
