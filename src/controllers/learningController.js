const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const { lessonIds, summarizeProgress, nextLesson } = require('../utils/courseTree');

// The signed-in learner's courses with progress and where to pick up.
async function myLearning(req, res) {
  const enrollments = await Enrollment.listForUser(req.user.id);
  const items = await Promise.all(
    enrollments.map(async (e) => {
      const course = await Course.findTreeBySlug(e.course.slug);
      const completed = await Progress.completedLessonIds(req.user.id, lessonIds(course));
      const { done, total, percent } = summarizeProgress(course, completed);
      return {
        course: {
          id: course.id,
          slug: course.slug,
          title: course.title,
          area: course.area,
          tier: course.tier,
          description: course.description,
          durationText: course.durationText,
        },
        status: e.status,
        progress: { done, total, percent },
        next: nextLesson(course, completed),
      };
    })
  );
  res.json(items);
}

// Progress can only be recorded on courses the learner is enrolled in.
async function loadEnrolledLesson(req, res) {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return null;
  }
  if (!(await Enrollment.find(req.user.id, lesson.module.courseId))) {
    res.status(403).json({ error: 'Enrol in this course first.' });
    return null;
  }
  return lesson;
}

async function markComplete(req, res) {
  const lesson = await loadEnrolledLesson(req, res);
  if (!lesson) return;
  await Progress.markComplete(req.user.id, lesson.id);
  res.status(204).send();
}

async function unmarkComplete(req, res) {
  const lesson = await loadEnrolledLesson(req, res);
  if (!lesson) return;
  await Progress.unmark(req.user.id, lesson.id);
  res.status(204).send();
}

module.exports = { myLearning, markComplete, unmarkComplete };
