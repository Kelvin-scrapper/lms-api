const prisma = require('../db');
const { ROLES } = require('./User');

async function summary() {
  const [users, courses, enrollments, byRole] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.user.groupBy({ by: ['role'], _count: true }),
  ]);
  const counts = Object.fromEntries(byRole.map((r) => [r.role, r._count]));
  return {
    users,
    courses,
    enrollments,
    usersByRole: Object.fromEntries(ROLES.map((r) => [r, counts[r] ?? 0])),
  };
}

module.exports = { summary };
