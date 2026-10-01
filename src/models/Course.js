const prisma = require('../db');

const INSTRUCTOR_SELECT = { id: true, name: true, email: true };

const TREE_INCLUDE = {
  instructors: { select: INSTRUCTOR_SELECT },
  modules: {
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: { resources: { orderBy: { order: 'asc' } } },
      },
    },
  },
};

async function list() {
  const courses = await prisma.course.findMany({
    orderBy: { order: 'asc' },
    include: {
      instructors: { select: INSTRUCTOR_SELECT },
      _count: { select: { modules: true, enrollments: true } },
    },
  });
  return courses.map(({ _count, ...c }) => ({
    ...c,
    moduleCount: _count.modules,
    enrollmentCount: _count.enrollments,
  }));
}

function findById(id) {
  return prisma.course.findUnique({ where: { id } });
}

function findTreeBySlug(slug) {
  return prisma.course.findUnique({ where: { slug }, include: TREE_INCLUDE });
}

// Courses a tutor can edit: all of them for an admin, otherwise the assigned ones.
async function listTeachable(user) {
  const courses = await prisma.course.findMany({
    where: user.role === 'ADMIN' ? {} : { instructors: { some: { id: user.id } } },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { modules: true, enrollments: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });
  return courses.map(({ _count, modules, ...c }) => ({
    ...c,
    moduleCount: _count.modules,
    lessonCount: modules.reduce((n, m) => n + m._count.lessons, 0),
    enrollmentCount: _count.enrollments,
  }));
}

async function canEdit(user, courseId) {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'INSTRUCTOR') return false;
  const link = await prisma.course.findFirst({
    where: { id: courseId, instructors: { some: { id: user.id } } },
    select: { id: true },
  });
  return Boolean(link);
}

function addInstructor(courseId, userId) {
  return prisma.course.update({ where: { id: courseId }, data: { instructors: { connect: { id: userId } } } });
}

function removeInstructor(courseId, userId) {
  return prisma.course.update({ where: { id: courseId }, data: { instructors: { disconnect: { id: userId } } } });
}

module.exports = { list, findById, findTreeBySlug, listTeachable, canEdit, addInstructor, removeInstructor };
