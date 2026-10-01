const prisma = require('../db');
const { swapWithNeighbour, nextOrder } = require('./ordering');

// Includes the module so callers can check which course the lesson belongs to.
function findById(id) {
  return prisma.lesson.findUnique({ where: { id }, include: { module: true } });
}

async function create(moduleId, title) {
  const order = await nextOrder(prisma.lesson, { moduleId });
  return prisma.lesson.create({ data: { moduleId, title, order, contentMarkdown: '', estMinutes: 10 } });
}

function update(id, { title, contentMarkdown, estMinutes }) {
  return prisma.lesson.update({ where: { id }, data: { title, contentMarkdown, estMinutes } });
}

function remove(id) {
  return prisma.lesson.delete({ where: { id } });
}

function move(lesson, direction) {
  return swapWithNeighbour(prisma.lesson, lesson, { moduleId: lesson.moduleId }, direction);
}

module.exports = { findById, create, update, remove, move };
