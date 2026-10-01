// Idempotent; the Docker image runs it on every start.
//  - Courses: the starting catalogue, only when the database has no courses.
//  - Demo accounts (all environments except production): an admin, a tutor and
//    a student with sample progress — only created if missing.
//  - SEED_ADMIN_EMAIL/NAME/PASSWORD: creates that admin, or resets its password
//    and access on every start (account recovery).
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password');
const { courses } = require('./courses');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Passw0rd!';
const DEMO_USERS = [
  { email: 'admin@summertech.ac.ke', name: 'Site Admin', role: 'ADMIN' },
  { email: 'grace@summertech.ac.ke', name: 'Grace Otieno', role: 'INSTRUCTOR' },
  { email: 'kelvin@summertech.ac.ke', name: 'Kelvin Muhea', role: 'STUDENT' },
];

async function seedCourses() {
  if ((await prisma.course.count()) > 0) return;

  for (const [ci, c] of courses.entries()) {
    await prisma.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        area: c.area,
        tier: c.tier,
        description: c.description,
        durationText: c.durationText,
        order: ci,
        modules: {
          create: c.modules.map((m, mi) => ({
            title: m.title,
            order: mi,
            lessons: {
              create: m.lessons.map((l, li) => ({
                title: l.title,
                order: li,
                estMinutes: l.minutes ?? 12,
                contentMarkdown: l.body ?? '',
                resources: { create: (l.resources ?? []).map((r, ri) => ({ ...r, order: ri })) },
              })),
            },
          })),
        },
      },
    });
  }
  console.log(`[seed] created ${courses.length} courses`);
}

async function seedDemoUsers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const created = {};
  for (const u of DEMO_USERS) {
    if (await prisma.user.findUnique({ where: { email: u.email } })) continue;
    created[u.role] = await prisma.user.create({ data: { ...u, passwordHash } });
  }

  const tutor = created.INSTRUCTOR;
  if (tutor) {
    for (const slug of ['full-stack-web-development', 'ui-ux-product-design']) {
      const course = await prisma.course.findUnique({ where: { slug } });
      if (course) {
        await prisma.course.update({ where: { id: course.id }, data: { instructors: { connect: { id: tutor.id } } } });
      }
    }
  }

  const student = created.STUDENT;
  const fullStack = await prisma.course.findUnique({
    where: { slug: 'full-stack-web-development' },
    include: { modules: { orderBy: { order: 'asc' }, include: { lessons: true } } },
  });
  if (student && fullStack) {
    await prisma.enrollment.create({ data: { userId: student.id, courseId: fullStack.id } });
    const firstModule = fullStack.modules[0];
    if (firstModule) {
      await prisma.lessonProgress.createMany({
        data: firstModule.lessons.map((l) => ({ userId: student.id, lessonId: l.id })),
      });
    }
  }

  if (Object.keys(created).length > 0) {
    console.log(`[seed] demo accounts created (password: ${DEMO_PASSWORD}):`);
    for (const u of Object.values(created)) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
  }
}

async function seedRecoveryAdmin() {
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD } = process.env;
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) return;

  const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', active: true, passwordHash },
    create: { email, name: SEED_ADMIN_NAME || 'Administrator', role: 'ADMIN', passwordHash },
  });
  console.log(`[seed] admin ${email} is ready`);
}

async function main() {
  await seedCourses();
  if (process.env.NODE_ENV !== 'production') await seedDemoUsers();
  await seedRecoveryAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
