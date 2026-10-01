const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../schemas/users');
const users = require('../controllers/usersController');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', users.list);
router.post('/', validate(schemas.createUser), users.create);
router.patch('/:id', validate(schemas.updateUser), users.update);

module.exports = router;
