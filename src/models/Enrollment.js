const prisma = require('../db');

function find(userId, courseId) {
  return prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

// Enrols, or re-activates a dropped enrolment.
function enroll(userId, courseId) {
  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { status: 'ACTIVE' },
    create: { userId, courseId },
  });
}

function listForUser(userId) {
  return prisma.enrollment.findMany({
    where: { userId, status: { not: 'DROPPED' } },
    orderBy: { enrolledAt: 'asc' },
    include: { course: { select: { slug: true } } },
  });
}

function listCourseIdsForUser(userId) {
  return prisma.enrollment
    .findMany({ where: { userId }, select: { courseId: true } })
    .then((rows) => rows.map((r) => r.courseId));
}

function listAll() {
  return prisma.enrollment.findMany({
    orderBy: { enrolledAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, slug: true, title: true } },
    },
  });
}

module.exports = { find, enroll, listForUser, listCourseIdsForUser, listAll };
