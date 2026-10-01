const prisma = require('../db');
const { swapWithNeighbour, nextOrder } = require('./ordering');

function findById(id) {
  return prisma.module.findUnique({ where: { id } });
}

async function create(courseId, title) {
  const order = await nextOrder(prisma.module, { courseId });
  return prisma.module.create({ data: { courseId, title, order } });
}

function rename(id, title) {
  return prisma.module.update({ where: { id }, data: { title } });
}

function remove(id) {
  return prisma.module.delete({ where: { id } });
}

function move(mod, direction) {
  return swapWithNeighbour(prisma.module, mod, { courseId: mod.courseId }, direction);
}

module.exports = { findById, create, rename, remove, move };
