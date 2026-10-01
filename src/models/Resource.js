const prisma = require('../db');
const { nextOrder } = require('./ordering');

const KINDS = ['VIDEO', 'PDF', 'SLIDES', 'LINK', 'OTHER'];

// Includes lesson → module so callers can check course ownership.
function findById(id) {
  return prisma.resource.findUnique({ where: { id }, include: { lesson: { include: { module: true } } } });
}

async function create(lessonId, { title, url, kind, sizeBytes }) {
  const order = await nextOrder(prisma.resource, { lessonId });
  return prisma.resource.create({ data: { lessonId, title, url, kind, sizeBytes: sizeBytes ?? null, order } });
}

function remove(id) {
  return prisma.resource.delete({ where: { id } });
}

module.exports = { KINDS, findById, create, remove };
