const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const User = require('../models/User');
const { lessonIds, summarizeProgress, nextLesson } = require('../utils/courseTree');

const STAFF = ['INSTRUCTOR', 'ADMIN'];

async function list(req, res) {
  const [courses, enrolledIds] = await Promise.all([Course.list(), Enrollment.listCourseIdsForUser(req.user.id)]);
  const enrolled = new Set(enrolledIds);
  const isAdmin = req.user.role === 'ADMIN';
  res.json(
    courses.map(({ enrollmentCount, ...c }) => ({
      ...c,
      enrolled: enrolled.has(c.id),
      ...(isAdmin ? { enrollmentCount } : {}),
    }))
  );
}

// Lesson notes and resources are only sent to enrolled learners and the
// course's tutors; everyone else sees the outline.
function shapeTree(course, withContent) {
  return {
    ...course,
    modules: course.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map(({ resources, contentMarkdown, ...l }) => ({
        ...l,
        resourceCount: resources.length,
        ...(withContent ? { contentMarkdown, resources } : {}),
      })),
    })),
  };
}

async function detail(req, res) {
  const course = await Course.findTreeBySlug(req.params.slug);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const [enrollment, canEdit, completed] = await Promise.all([
    Enrollment.find(req.user.id, course.id),
    Course.canEdit(req.user, course.id),
    Progress.completedLessonIds(req.user.id, lessonIds(course)),
  ]);

  res.json({
    course: shapeTree(course, Boolean(enrollment) || canEdit),
    enrollment: enrollment ? { status: enrollment.status, enrolledAt: enrollment.enrolledAt } : null,
    canEdit,
    progress: summarizeProgress(course, completed),
    next: nextLesson(course, completed),
  });
}

async function enroll(req, res) {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const enrollment = await Enrollment.enroll(req.user.id, course.id);
  res.status(201).json({ enrollment, slug: course.slug });
}

async function addInstructor(req, res) {
  const [course, user] = await Promise.all([Course.findById(req.params.id), User.findById(req.body.userId)]);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (!user || !STAFF.includes(user.role)) {
    return res.status(400).json({ error: 'Only instructors and admins can be assigned as tutors.', field: 'userId' });
  }
  await Course.addInstructor(course.id, user.id);
  res.status(204).send();
}

async function removeInstructor(req, res) {
  if (!(await Course.findById(req.params.id))) return res.status(404).json({ error: 'Course not found' });
  await Course.removeInstructor(req.params.id, req.params.userId);
  res.status(204).send();
}

module.exports = { list, detail, enroll, addInstructor, removeInstructor };
