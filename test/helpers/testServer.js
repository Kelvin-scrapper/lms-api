// Boots the real Express app against a fresh Postgres schema created inside
// TEST_DATABASE_URL just for this run, and drops only that schema afterwards,
// so existing data in the database is never touched.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });

const PASSWORD = 'password123';

function useTestSchema() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL to a development database (see .env.example).');
  }
  const schema = `lms_test_${process.pid}_${Date.now()}`;
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  // The schema is brand new, so this only creates tables.
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
    cwd: ROOT,
    env: process.env,
    stdio: 'ignore',
  });
  return schema;
}

async function seedFixtures(prisma) {
  const { hashPassword } = require(path.join(ROOT, 'src/utils/password'));
  const passwordHash = await hashPassword(PASSWORD);
  const user = (email, name, role, extra = {}) =>
    prisma.user.create({ data: { email, name, role, passwordHash, ...extra } });

  const users = {
    admin: await user('admin@test.ke', 'Ada Admin', 'ADMIN'),
    tutor: await user('tutor@test.ke', 'Tom Tutor', 'INSTRUCTOR'),
    tutor2: await user('tutor2@test.ke', 'Tia Tutor', 'INSTRUCTOR'),
    student: await user('student@test.ke', 'Sam Student', 'STUDENT'),
    student2: await user('student2@test.ke', 'Sue Student', 'STUDENT'),
    suspended: await user('suspended@test.ke', 'Sid Suspended', 'STUDENT', { active: false }),
    linkOnly: await user('link@test.ke', 'Lee Link', 'STUDENT', { passwordHash: null }),
  };

  const course = (slug, title, order, instructorId) =>
    prisma.course.create({
      data: {
        slug,
        title,
        area: 'Web Development',
        tier: 'Bootcamp',
        description: `${title} description`,
        durationText: '6 weeks',
        order,
        instructors: { connect: [{ id: instructorId }] },
        modules: {
          create: [0, 1].map((mi) => ({
            title: `${title} module ${mi + 1}`,
            order: mi,
            lessons: {
              create: [0, 1].map((li) => ({
                title: `Lesson ${mi + 1}.${li + 1}`,
                order: li,
                contentMarkdown: `Notes for ${mi + 1}.${li + 1}`,
                resources: li === 0 ? { create: [{ title: 'Video', url: 'https://youtu.be/abc', kind: 'VIDEO' }] } : undefined,
              })),
            },
          })),
        },
      },
      include: { modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
    });

  const courses = {
    web: await course('web', 'Web Course', 0, users.tutor.id),
    design: await course('design', 'Design Course', 1, users.tutor2.id),
  };

  return { users, courses };
}

async function startTestServer() {
  const schema = useTestSchema();
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
  process.env.NODE_ENV = 'test';
  process.env.APP_URL = 'http://frontend.test';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-uploads-'));

  // Capture outgoing email instead of printing/sending it.
  const sent = [];
  require(path.join(ROOT, 'src/utils/email')).sendEmail = async (msg) => {
    sent.push(msg);
  };

  const prisma = require(path.join(ROOT, 'src/db'));
  const fixtures = await seedFixtures(prisma);

  const app = require(path.join(ROOT, 'src/index.js'));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.API_PUBLIC_URL = base;

  async function request(method, urlPath, token, body) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = body;
    if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    } else if (typeof body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(base + urlPath, { method, headers, body: payload });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, body: json, text, headers: res.headers };
  }

  async function login(email, password = PASSWORD) {
    const res = await request('POST', '/auth/login', null, { email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${res.text}`);
    return res.body.token;
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    // Only ever the schema this run created (generated name, never user input).
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$disconnect();
    fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  }

  return { prisma, request, login, stop, sent, base, PASSWORD, ...fixtures };
}

module.exports = { startTestServer };
