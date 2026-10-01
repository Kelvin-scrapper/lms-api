const prisma = require('../db');

function revoke(jti, expiresAt) {
  return prisma.revokedToken.upsert({
    where: { jti },
    update: {},
    create: { jti, expiresAt },
  });
}

async function isRevoked(jti) {
  if (!jti) return false;
  return Boolean(await prisma.revokedToken.findUnique({ where: { jti } }));
}

async function purgeExpired() {
  const { count } = await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

module.exports = { revoke, isRevoked, purgeExpired };
