const User = require('../models/User');
const { hashPassword, passwordProblem } = require('../utils/password');

async function list(req, res) {
  const roles = typeof req.query.roles === 'string' ? req.query.roles.split(',').filter((r) => User.ROLES.includes(r)) : undefined;
  res.json(await User.list({ roles }));
}

async function create(req, res) {
  const { email, name, role, password } = req.body;
  if (password) {
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem, field: 'password' });
  }
  if (await User.findByEmail(email)) {
    return res.status(409).json({ error: 'A user with that email already exists.', field: 'email' });
  }

  const user = await User.create({
    email,
    name,
    role,
    passwordHash: password ? await hashPassword(password) : null,
  });
  res.status(201).json(user);
}

async function update(req, res) {
  // An admin can't suspend or demote themselves (and lock everyone out by accident).
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You can't change your own role or access." });
  }
  if (!(await User.findById(req.params.id))) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { role, active } = req.body;
  res.json(await User.update(req.params.id, { role, active }));
}

module.exports = { list, create, update };
