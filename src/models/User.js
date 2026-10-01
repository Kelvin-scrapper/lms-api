const prisma = require('../db');

const ROLES = ['STUDENT', 'MENTOR', 'INSTRUCTOR', 'ADMIN'];
const MAX_EMAIL_LENGTH = 254;

// The shape every endpoint returns; never includes the password hash.
function toPublic(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    hasPassword: Boolean(user.passwordHash),
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

// Includes passwordHash — for the auth controller only.
function findByEmail(email) {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}

function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

async function findActiveById(id) {
  const user = await findById(id);
  return user && user.active ? user : null;
}

async function list({ roles } = {}) {
  const users = await prisma.user.findMany({
    where: roles?.length ? { role: { in: roles } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { enrollments: true, teaches: true } } },
  });
  return users.map((u) => ({
    ...toPublic(u),
    enrollmentCount: u._count.enrollments,
    teachingCount: u._count.teaches,
  }));
}

async function create({ email, name, role, passwordHash }) {
  const user = await prisma.user.create({
    data: { email: normalizeEmail(email), name, role, passwordHash: passwordHash ?? null },
  });
  return toPublic(user);
}

async function update(id, data) {
  return toPublic(await prisma.user.update({ where: { id }, data }));
}

function markEmailVerified(id) {
  return prisma.user.update({ where: { id }, data: { emailVerified: new Date() } });
}

module.exports = {
  ROLES,
  MAX_EMAIL_LENGTH,
  toPublic,
  normalizeEmail,
  findByEmail,
  findById,
  findActiveById,
  list,
  create,
  update,
  markEmailVerified,
};
