const os = require('os');
const express = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../schemas/courses');
const teach = require('../controllers/teachController');

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 200;

// Files land in the OS temp dir first, so large videos never sit in memory.
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

const router = express.Router();

router.use(authenticate, requireRole('INSTRUCTOR', 'ADMIN'));

router.get('/courses', teach.list);
router.get('/courses/:slug', teach.detail);
router.post('/courses/:courseId/modules', validate(schemas.titled), teach.createModule);

router.patch('/modules/:id', validate(schemas.titled), teach.renameModule);
router.delete('/modules/:id', teach.deleteModule);
router.post('/modules/:id/move', validate(schemas.move), teach.moveModule);
router.post('/modules/:id/lessons', validate(schemas.titled), teach.createLesson);

router.patch('/lessons/:id', validate(schemas.updateLesson), teach.updateLesson);
router.delete('/lessons/:id', teach.deleteLesson);
router.post('/lessons/:id/move', validate(schemas.move), teach.moveLesson);
router.post('/lessons/:id/resources', validate(schemas.resourceLink), teach.addResourceLink);
router.post('/lessons/:id/resources/upload', upload.single('file'), teach.uploadResource);

router.delete('/resources/:id', teach.deleteResource);

module.exports = router;
