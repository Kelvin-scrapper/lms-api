const express = require('express');
const { authenticate } = require('../middleware/auth');
const { loginRateLimit, magicLinkRateLimit } = require('../middleware/rateLimits');
const validate = require('../middleware/validate');
const schemas = require('../schemas/auth');
const auth = require('../controllers/authController');

const router = express.Router();

router.post('/login', loginRateLimit, validate(schemas.login), auth.login);
router.post('/logout', authenticate, auth.logout);
router.post('/magic-link', magicLinkRateLimit, validate(schemas.magicLinkRequest), auth.requestMagicLink);
router.post('/magic-link/verify', loginRateLimit, validate(schemas.magicLinkVerify), auth.verifyMagicLink);
router.get('/me', authenticate, auth.me);
router.patch('/me', authenticate, validate(schemas.updateProfile), auth.updateMe);
router.put('/me/password', authenticate, validate(schemas.changePassword), auth.changePassword);

module.exports = router;
