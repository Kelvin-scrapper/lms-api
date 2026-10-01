const prisma = require('../db');

// Swaps an item's `order` with its neighbour in the same parent. `delegate` is
// a Prisma model (prisma.module / prisma.lesson); `scope` limits the siblings.
async function swapWithNeighbour(delegate, item, scope, direction) {
  const sibling = await delegate.findFirst({
    where: { ...scope, order: direction === 'up' ? { lt: item.order } : { gt: item.order } },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!sibling) return false;
  await prisma.$transaction([
    delegate.update({ where: { id: item.id }, data: { order: sibling.order } }),
    delegate.update({ where: { id: sibling.id }, data: { order: item.order } }),
  ]);
  return true;
}

// Next free `order` value at the end of a parent's list.
async function nextOrder(delegate, scope) {
  const last = await delegate.findFirst({ where: scope, orderBy: { order: 'desc' }, select: { order: true } });
  return last ? last.order + 1 : 0;
}

module.exports = { swapWithNeighbour, nextOrder };
