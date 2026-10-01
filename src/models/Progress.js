const prisma = require('../db');

async function completedLessonIds(userId, lessonIds) {
  if (lessonIds.length === 0) return [];
  const rows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { lessonId: true },
  });
  return rows.map((r) => r.lessonId);
}

function markComplete(userId, lessonId) {
  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: {},
    create: { userId, lessonId },
  });
}

function unmark(userId, lessonId) {
  return prisma.lessonProgress.deleteMany({ where: { userId, lessonId } });
}

module.exports = { completedLessonIds, markComplete, unmark };
