const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

async function list(req, res) {
  res.json(await Enrollment.listAll());
}

async function create(req, res) {
  const { userId, courseId } = req.body;
  const [user, course] = await Promise.all([User.findById(userId), Course.findById(courseId)]);
  if (!user) return res.status(404).json({ error: 'Learner not found', field: 'userId' });
  if (!course) return res.status(404).json({ error: 'Course not found', field: 'courseId' });
  res.status(201).json(await Enrollment.enroll(user.id, course.id));
}

module.exports = { list, create };
