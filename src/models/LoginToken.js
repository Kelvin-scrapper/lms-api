const crypto = require('crypto');
const prisma = require('../db');

const TTL_MINUTES = 20;

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Returns the raw token; only its hash is stored.
async function issue(email) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.loginToken.create({
    data: { identifier: email, tokenHash: hash(token), expires: new Date(Date.now() + TTL_MINUTES * 60 * 1000) },
  });
  return token;
}

// Marks the token used and returns true if it was valid for this email.
async function consume(email, token) {
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!record || record.identifier !== email || record.usedAt || record.expires.getTime() < Date.now()) {
    return false;
  }
  // updateMany with usedAt: null so two concurrent clicks can't both succeed.
  const { count } = await prisma.loginToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

async function purgeStale() {
  const { count } = await prisma.loginToken.deleteMany({
    where: { OR: [{ usedAt: { not: null } }, { expires: { lt: new Date() } }] },
  });
  return count;
}

module.exports = { TTL_MINUTES, issue, consume, purgeStale };
