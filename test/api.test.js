// End-to-end tests for every API endpoint. Run with `npm test`.
// Tests within a describe run in order and share state (tokens, ids).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers/testServer');

let t;
const tokens = {};

before(async () => {
  console.warn = () => {};
  console.info = () => {};
  t = await startTestServer();
  for (const key of ['admin', 'tutor', 'tutor2', 'student', 'student2']) {
    tokens[key] = await t.login(t.users[key].email);
  }
});

after(() => t.stop());

describe('health and errors', () => {
  it('reports the database as connected', async () => {
    const res = await t.request('GET', '/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', db: 'connected' });
  });

  it('returns JSON 404s for unknown routes', async () => {
    const res = await t.request('GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not found');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await t.request('POST', '/auth/login', null, '{bad json');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid JSON/);
  });

  it('requires a bearer token on protected routes', async () => {
    assert.equal((await t.request('GET', '/courses')).status, 401);
    assert.equal((await t.request('GET', '/courses', 'not-a-jwt')).status, 401);
  });
});

describe('auth', () => {
  it('signs in case-insensitively and never returns the password hash', async () => {
    const res = await t.request('POST', '/auth/login', null, { email: ' Student@Test.KE ', password: t.PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'student@test.ke');
    assert.equal(res.body.user.hasPassword, true);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await t.request('POST', '/auth/login', null, { email: 'student@test.ke', password: 'nope-nope' });
    const unknown = await t.request('POST', '/auth/login', null, { email: 'ghost@test.ke', password: 'nope-nope' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);
  });

  it('refuses suspended accounts', async () => {
    const res = await t.request('POST', '/auth/login', null, { email: 'suspended@test.ke', password: t.PASSWORD });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /suspended/);
  });

  it('validates the body', async () => {
    const res = await t.request('POST', '/auth/login', null, { email: 'not-an-email', password: 'x' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'email');
  });

  it('returns the current user', async () => {
    const res = await t.request('GET', '/auth/me', tokens.student);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'student@test.ke');
    assert.equal(res.body.role, 'STUDENT');
  });

  it('revokes the token on logout', async () => {
    const token = await t.login('student2@test.ke');
    assert.equal((await t.request('POST', '/auth/logout', token)).status, 204);
    const res = await t.request('GET', '/auth/me', token);
    assert.equal(res.status, 401);
    assert.match(res.body.error, /revoked/);
    // Other sessions for the same user are unaffected.
    assert.equal((await t.request('GET', '/auth/me', tokens.student2)).status, 200);
  });
});

describe('magic links', () => {
  let link;

  it('emails a link that points at the frontend', async () => {
    const res = await t.request('POST', '/auth/magic-link', null, { email: 'link@test.ke' });
    assert.equal(res.status, 202);
    assert.equal(t.sent.length, 1);
    assert.equal(t.sent[0].to, 'link@test.ke');
    link = new URL(t.sent[0].text.match(/https?:\/\/\S+/)[0]);
    assert.equal(link.origin, 'http://frontend.test');
    assert.equal(link.pathname, '/api/auth/verify');
  });

  it("doesn't reveal or email unknown and suspended accounts", async () => {
    const unknown = await t.request('POST', '/auth/magic-link', null, { email: 'ghost@test.ke' });
    const suspended = await t.request('POST', '/auth/magic-link', null, { email: 'suspended@test.ke' });
    assert.equal(unknown.status, 202);
    assert.equal(suspended.status, 202);
    assert.equal(unknown.body.message, suspended.body.message);
    assert.equal(t.sent.length, 1);
  });

  it('exchanges the link for a session and marks the email verified', async () => {
    const res = await t.request('POST', '/auth/magic-link/verify', null, {
      email: link.searchParams.get('email'),
      token: link.searchParams.get('token'),
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.user.emailVerified);
    assert.equal(res.body.user.hasPassword, false);
  });

  it('only works once', async () => {
    const res = await t.request('POST', '/auth/magic-link/verify', null, {
      email: link.searchParams.get('email'),
      token: link.searchParams.get('token'),
    });
    assert.equal(res.status, 400);
  });

  it("can't be used for a different email", async () => {
    await t.request('POST', '/auth/magic-link', null, { email: 'student@test.ke' });
    const fresh = new URL(t.sent.at(-1).text.match(/https?:\/\/\S+/)[0]);
    const res = await t.request('POST', '/auth/magic-link/verify', null, {
      email: 'admin@test.ke',
      token: fresh.searchParams.get('token'),
    });
    assert.equal(res.status, 400);
  });
});

describe('profile', () => {
  it('updates the name', async () => {
    const res = await t.request('PATCH', '/auth/me', tokens.student, { name: '  Samuel Student ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Samuel Student');
  });

  it('rejects a too-short name', async () => {
    assert.equal((await t.request('PATCH', '/auth/me', tokens.student, { name: 'S' })).status, 400);
  });

  it('requires the current password to change it', async () => {
    const res = await t.request('PUT', '/auth/me/password', tokens.student, { current: 'wrong-one', next: 'new-password-1' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'current');
  });

  it('enforces a minimum length', async () => {
    const res = await t.request('PUT', '/auth/me/password', tokens.student, { current: t.PASSWORD, next: 'short' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'next');
  });

  it('changes the password', async () => {
    const res = await t.request('PUT', '/auth/me/password', tokens.student, { current: t.PASSWORD, next: 'new-password-1' });
    assert.equal(res.status, 204);
    assert.ok(await t.login('student@test.ke', 'new-password-1'));
    await t.request('PUT', '/auth/me/password', tokens.student, { current: 'new-password-1', next: t.PASSWORD });
  });
});

describe('courses and learning', () => {
  it('lists courses with the enrolled flag; counts only for admins', async () => {
    const res = await t.request('GET', '/courses', tokens.student);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((c) => c.slug), ['web', 'design']);
    assert.equal(res.body[0].enrolled, false);
    assert.equal(res.body[0].moduleCount, 2);
    assert.equal(res.body[0].enrollmentCount, undefined);
    const admin = await t.request('GET', '/courses', tokens.admin);
    assert.equal(admin.body[0].enrollmentCount, 0);
  });

  it('shows only the outline before enrolling', async () => {
    const res = await t.request('GET', '/courses/web', tokens.student);
    assert.equal(res.status, 200);
    assert.equal(res.body.enrollment, null);
    const lesson = res.body.course.modules[0].lessons[0];
    assert.equal(lesson.contentMarkdown, undefined);
    assert.equal(lesson.resources, undefined);
    assert.equal(lesson.resourceCount, 1);
    assert.deepEqual(res.body.progress, { completedLessonIds: [], done: 0, total: 4, percent: 0 });
  });

  it('404s an unknown course', async () => {
    assert.equal((await t.request('GET', '/courses/missing', tokens.student)).status, 404);
  });

  it("won't record progress before enrolling", async () => {
    const lessonId = t.courses.web.modules[0].lessons[0].id;
    assert.equal((await t.request('PUT', `/learning/lessons/${lessonId}/complete`, tokens.student)).status, 403);
  });

  it('enrols, then shows content', async () => {
    const res = await t.request('POST', `/courses/${t.courses.web.id}/enroll`, tokens.student);
    assert.equal(res.status, 201);
    assert.equal(res.body.slug, 'web');
    const detail = await t.request('GET', '/courses/web', tokens.student);
    assert.equal(detail.body.enrollment.status, 'ACTIVE');
    assert.equal(detail.body.course.modules[0].lessons[0].contentMarkdown, 'Notes for 1.1');
    assert.equal(detail.body.course.modules[0].lessons[0].resources.length, 1);
  });

  it('tracks progress and the next lesson', async () => {
    const [first, second] = t.courses.web.modules[0].lessons;
    assert.equal((await t.request('PUT', `/learning/lessons/${first.id}/complete`, tokens.student)).status, 204);
    // Idempotent.
    assert.equal((await t.request('PUT', `/learning/lessons/${first.id}/complete`, tokens.student)).status, 204);
    const detail = await t.request('GET', '/courses/web', tokens.student);
    assert.equal(detail.body.progress.percent, 25);
    assert.equal(detail.body.next.lessonId, second.id);

    const dash = await t.request('GET', '/learning', tokens.student);
    assert.equal(dash.status, 200);
    assert.equal(dash.body.length, 1);
    assert.equal(dash.body[0].course.slug, 'web');
    assert.deepEqual(dash.body[0].progress, { done: 1, total: 4, percent: 25 });
    assert.equal(dash.body[0].next.lessonTitle, 'Lesson 1.2');
  });

  it('un-marks a lesson', async () => {
    const first = t.courses.web.modules[0].lessons[0];
    assert.equal((await t.request('DELETE', `/learning/lessons/${first.id}/complete`, tokens.student)).status, 204);
    const detail = await t.request('GET', '/courses/web', tokens.student);
    assert.equal(detail.body.progress.done, 0);
  });

  it("lets a course's tutor see content without enrolling", async () => {
    const res = await t.request('GET', '/courses/web', tokens.tutor);
    assert.equal(res.body.canEdit, true);
    assert.equal(res.body.course.modules[0].lessons[0].contentMarkdown, 'Notes for 1.1');
    const other = await t.request('GET', '/courses/web', tokens.tutor2);
    assert.equal(other.body.canEdit, false);
    assert.equal(other.body.course.modules[0].lessons[0].contentMarkdown, undefined);
  });
});

describe('teaching', () => {
  let moduleId;
  let lessonId;

  it('is closed to students', async () => {
    assert.equal((await t.request('GET', '/teach/courses', tokens.student)).status, 403);
  });

  it("lists a tutor's own courses; admins see all", async () => {
    const tutor = await t.request('GET', '/teach/courses', tokens.tutor);
    assert.deepEqual(tutor.body.map((c) => c.slug), ['web']);
    assert.equal(tutor.body[0].lessonCount, 4);
    assert.equal(tutor.body[0].enrollmentCount, 1);
    const admin = await t.request('GET', '/teach/courses', tokens.admin);
    assert.deepEqual(admin.body.map((c) => c.slug), ['web', 'design']);
  });

  it("blocks editing a course you don't tutor", async () => {
    assert.equal((await t.request('GET', '/teach/courses/design', tokens.tutor)).status, 403);
    const res = await t.request('POST', `/teach/courses/${t.courses.design.id}/modules`, tokens.tutor, { title: 'Sneaky' });
    assert.equal(res.status, 403);
    const lesson = t.courses.design.modules[0].lessons[0];
    assert.equal((await t.request('PATCH', `/teach/lessons/${lesson.id}`, tokens.tutor, { title: 'x' })).status, 403);
  });

  it('adds a module at the end', async () => {
    const res = await t.request('POST', `/teach/courses/${t.courses.web.id}/modules`, tokens.tutor, { title: '  Capstone ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Capstone');
    assert.equal(res.body.order, 2);
    moduleId = res.body.id;
  });

  it('requires a title', async () => {
    const res = await t.request('POST', `/teach/courses/${t.courses.web.id}/modules`, tokens.tutor, { title: '   ' });
    assert.equal(res.status, 400);
  });

  it('renames and reorders modules', async () => {
    assert.equal((await t.request('PATCH', `/teach/modules/${moduleId}`, tokens.tutor, { title: 'Final project' })).status, 200);
    assert.equal((await t.request('POST', `/teach/modules/${moduleId}/move`, tokens.tutor, { direction: 'up' })).status, 204);
    const tree = await t.request('GET', '/teach/courses/web', tokens.tutor);
    assert.deepEqual(tree.body.modules.map((m) => m.title), ['Web Course module 1', 'Final project', 'Web Course module 2']);
    // Moving past the end is a no-op.
    const top = tree.body.modules[0].id;
    assert.equal((await t.request('POST', `/teach/modules/${top}/move`, tokens.tutor, { direction: 'up' })).status, 204);
    assert.equal((await t.request('POST', `/teach/modules/${top}/move`, tokens.tutor, { direction: 'sideways' })).status, 400);
  });

  it('adds, edits and reorders lessons', async () => {
    const a = await t.request('POST', `/teach/modules/${moduleId}/lessons`, tokens.tutor, { title: 'Plan' });
    const b = await t.request('POST', `/teach/modules/${moduleId}/lessons`, tokens.tutor, { title: 'Build' });
    assert.equal(a.status, 201);
    assert.equal(b.body.order, 1);
    lessonId = b.body.id;

    const upd = await t.request('PATCH', `/teach/lessons/${lessonId}`, tokens.tutor, {
      title: 'Build it',
      contentMarkdown: '## Steps',
      estMinutes: '45',
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.estMinutes, 45);
    assert.equal(upd.body.contentMarkdown, '## Steps');

    assert.equal((await t.request('POST', `/teach/lessons/${lessonId}/move`, tokens.tutor, { direction: 'up' })).status, 204);
    const tree = await t.request('GET', '/teach/courses/web', tokens.tutor);
    const mod = tree.body.modules.find((m) => m.id === moduleId);
    assert.deepEqual(mod.lessons.map((l) => l.title), ['Build it', 'Plan']);
  });

  it('rejects out-of-range minutes', async () => {
    const res = await t.request('PATCH', `/teach/lessons/${lessonId}`, tokens.tutor, { title: 'x', estMinutes: 0 });
    assert.equal(res.status, 400);
  });

  it('attaches links, but only http(s)', async () => {
    const bad = await t.request('POST', `/teach/lessons/${lessonId}/resources`, tokens.tutor, {
      title: 'Evil',
      url: 'javascript:alert(1)',
      kind: 'LINK',
    });
    assert.equal(bad.status, 400);
    const ok = await t.request('POST', `/teach/lessons/${lessonId}/resources`, tokens.tutor, {
      title: 'Slides',
      url: 'https://example.com/deck',
      kind: 'SLIDES',
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.kind, 'SLIDES');
  });

  it('uploads a file and serves it back', async () => {
    const form = new FormData();
    form.append('title', 'Worksheet');
    form.append('file', new Blob(['%PDF-1.4 hello'], { type: 'application/pdf' }), 'work sheet.pdf');
    const res = await t.request('POST', `/teach/lessons/${lessonId}/resources/upload`, tokens.tutor, form);
    assert.equal(res.status, 201);
    assert.equal(res.body.kind, 'PDF');
    assert.equal(res.body.title, 'Worksheet');
    assert.equal(res.body.sizeBytes, 14);
    assert.ok(res.body.url.startsWith(`${t.base}/files/`));

    const file = await fetch(res.body.url);
    assert.equal(file.status, 200);
    assert.equal(await file.text(), '%PDF-1.4 hello');
  });

  it('rejects uploads without a file or to a course you don\'t tutor', async () => {
    assert.equal((await t.request('POST', `/teach/lessons/${lessonId}/resources/upload`, tokens.tutor, new FormData())).status, 400);
    const form = new FormData();
    form.append('file', new Blob(['x']), 'x.txt');
    const other = t.courses.design.modules[0].lessons[0].id;
    assert.equal((await t.request('POST', `/teach/lessons/${other}/resources/upload`, tokens.tutor, form)).status, 403);
  });

  it("doesn't serve paths outside the upload folder", async () => {
    assert.equal((await t.request('GET', '/files/..%2F..%2Fpackage.json')).status, 404);
  });

  it('deletes resources, lessons and modules', async () => {
    const tree = await t.request('GET', '/teach/courses/web', tokens.tutor);
    const mod = tree.body.modules.find((m) => m.id === moduleId);
    const resource = mod.lessons.find((l) => l.id === lessonId).resources[0];
    assert.equal((await t.request('DELETE', `/teach/resources/${resource.id}`, tokens.tutor)).status, 204);
    assert.equal((await t.request('DELETE', `/teach/lessons/${lessonId}`, tokens.tutor)).status, 204);
    assert.equal((await t.request('DELETE', `/teach/lessons/${lessonId}`, tokens.tutor)).status, 404);
    assert.equal((await t.request('DELETE', `/teach/modules/${moduleId}`, tokens.tutor)).status, 204);
    const after = await t.request('GET', '/teach/courses/web', tokens.tutor);
    assert.equal(after.body.modules.length, 2);
  });

  it('lets an admin edit any course', async () => {
    const res = await t.request('POST', `/teach/courses/${t.courses.design.id}/modules`, tokens.admin, { title: 'Admin module' });
    assert.equal(res.status, 201);
  });
});

describe('direct uploads', () => {
  const storage = require('../src/utils/storage');
  const { getPayloadFromClientToken } = require('@vercel/blob/client');
  const realDescribe = storage.describeUploadedBlob;
  let lesson;

  before(() => {
    lesson = t.courses.web.modules[0].lessons[0];
  });

  after(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    storage.describeUploadedBlob = realDescribe;
  });

  it('tells the app to fall back when Blob storage is off', async () => {
    const res = await t.request('POST', `/teach/lessons/${lesson.id}/resources/upload-url`, tokens.tutor, {
      filename: 'intro.mp4',
      size: 1000,
    });
    assert.equal(res.status, 501);
    assert.equal(res.body.fallback, 'proxy');
  });

  it("issues a one-file upload token scoped to the lesson's folder", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teststore_supersecretvalue1234';
    const res = await t.request('POST', `/teach/lessons/${lesson.id}/resources/upload-url`, tokens.tutor, {
      filename: 'Week 1 intro.mp4',
      size: 300 * 1024 * 1024,
    });
    assert.equal(res.status, 200);
    assert.match(res.body.pathname, new RegExp(`^lessons/${lesson.id}/[0-9a-f-]{36}-Week_1_intro\\.mp4$`));
    const payload = getPayloadFromClientToken(res.body.clientToken);
    assert.equal(payload.pathname, res.body.pathname);
    assert.equal(payload.maximumSizeInBytes, 500 * 1024 * 1024);
    assert.ok(payload.validUntil > Date.now());
  });

  it('rejects oversized files and other tutors', async () => {
    const big = await t.request('POST', `/teach/lessons/${lesson.id}/resources/upload-url`, tokens.tutor, {
      filename: 'huge.mp4',
      size: 501 * 1024 * 1024,
    });
    assert.equal(big.status, 413);
    const other = await t.request('POST', `/teach/lessons/${lesson.id}/resources/upload-url`, tokens.tutor2, {
      filename: 'x.mp4',
      size: 10,
    });
    assert.equal(other.status, 403);
  });

  it('records an uploaded file using the size reported by storage', async () => {
    const pathname = `lessons/${lesson.id}/11111111-2222-3333-4444-555555555555-Week_1_intro.mp4`;
    storage.describeUploadedBlob = async (url) => ({ url, pathname, size: 314572800 });
    const res = await t.request('POST', `/teach/lessons/${lesson.id}/resources/uploaded`, tokens.tutor, {
      url: `https://teststore.public.blob.vercel-storage.com/${pathname}`,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.kind, 'VIDEO');
    assert.equal(res.body.title, 'Week_1_intro.mp4');
    assert.equal(res.body.sizeBytes, 314572800);
  });

  it("refuses files from another lesson's folder or that don't exist", async () => {
    storage.describeUploadedBlob = async (url) => ({ url, pathname: 'lessons/someone-else/x.mp4', size: 1 });
    const foreign = await t.request('POST', `/teach/lessons/${lesson.id}/resources/uploaded`, tokens.tutor, {
      url: 'https://teststore.public.blob.vercel-storage.com/lessons/someone-else/x.mp4',
    });
    assert.equal(foreign.status, 400);

    storage.describeUploadedBlob = async () => {
      throw new Error('BlobNotFoundError');
    };
    const missing = await t.request('POST', `/teach/lessons/${lesson.id}/resources/uploaded`, tokens.tutor, {
      url: 'https://teststore.public.blob.vercel-storage.com/nope.mp4',
    });
    assert.equal(missing.status, 400);
  });
});

describe('scheduled jobs', () => {
  after(() => {
    delete process.env.CRON_SECRET;
  });

  it('is closed unless CRON_SECRET is set and sent', async () => {
    assert.equal((await t.request('GET', '/jobs/purge-tokens')).status, 401);
    process.env.CRON_SECRET = 'cron-secret-value';
    assert.equal((await t.request('GET', '/jobs/purge-tokens', 'wrong')).status, 401);
  });

  it('purges used sign-in links', async () => {
    const before = await t.prisma.loginToken.count();
    assert.ok(before > 0);
    const res = await t.request('GET', '/jobs/purge-tokens', 'cron-secret-value');
    assert.equal(res.status, 200);
    // Only used/expired links go; the unused one from the magic-link tests stays.
    assert.ok((await t.prisma.loginToken.count()) < before);
  });
});

describe('admin', () => {
  let newUserId;

  it('is closed to non-admins', async () => {
    for (const path of ['/users', '/enrollments', '/stats']) {
      assert.equal((await t.request('GET', path, tokens.tutor)).status, 403, path);
    }
  });

  it('lists users with counts, filterable by role', async () => {
    const res = await t.request('GET', '/users', tokens.admin);
    assert.equal(res.status, 200);
    const tutor = res.body.find((u) => u.email === 'tutor@test.ke');
    assert.equal(tutor.teachingCount, 1);
    assert.ok(res.body.every((u) => u.passwordHash === undefined));
    const staff = await t.request('GET', '/users?roles=INSTRUCTOR,ADMIN', tokens.admin);
    assert.deepEqual(new Set(staff.body.map((u) => u.role)), new Set(['INSTRUCTOR', 'ADMIN']));
  });

  it('creates users, with or without a password', async () => {
    const withPw = await t.request('POST', '/users', tokens.admin, {
      email: 'New@Test.ke',
      name: 'New Person',
      role: 'STUDENT',
      password: 'a-good-password',
    });
    assert.equal(withPw.status, 201);
    assert.equal(withPw.body.email, 'new@test.ke');
    newUserId = withPw.body.id;
    assert.ok(await t.login('new@test.ke', 'a-good-password'));

    const linkOnly = await t.request('POST', '/users', tokens.admin, { email: 'nopw@test.ke', name: 'No Password', password: '' });
    assert.equal(linkOnly.status, 201);
    assert.equal(linkOnly.body.hasPassword, false);
    assert.equal(linkOnly.body.role, 'STUDENT');
  });

  it('rejects duplicates, weak passwords and bad roles', async () => {
    assert.equal((await t.request('POST', '/users', tokens.admin, { email: 'new@test.ke', name: 'Dup' })).status, 409);
    assert.equal((await t.request('POST', '/users', tokens.admin, { email: 'w@test.ke', name: 'Weak', password: 'short' })).status, 400);
    assert.equal((await t.request('POST', '/users', tokens.admin, { email: 'r@test.ke', name: 'Role', role: 'KING' })).status, 400);
  });

  it('changes roles and suspends users, which ends their sessions', async () => {
    const userToken = await t.login('new@test.ke', 'a-good-password');
    const role = await t.request('PATCH', `/users/${newUserId}`, tokens.admin, { role: 'MENTOR' });
    assert.equal(role.status, 200);
    assert.equal(role.body.role, 'MENTOR');

    assert.equal((await t.request('PATCH', `/users/${newUserId}`, tokens.admin, { active: false })).status, 200);
    assert.equal((await t.request('GET', '/auth/me', userToken)).status, 401);
    assert.equal((await t.request('POST', '/auth/login', null, { email: 'new@test.ke', password: 'a-good-password' })).status, 403);
  });

  it("won't let an admin change their own access", async () => {
    const res = await t.request('PATCH', `/users/${t.users.admin.id}`, tokens.admin, { active: false });
    assert.equal(res.status, 400);
  });

  it('enrols learners and lists enrolments', async () => {
    const res = await t.request('POST', '/enrollments', tokens.admin, { userId: t.users.student2.id, courseId: t.courses.design.id });
    assert.equal(res.status, 201);
    assert.equal((await t.request('POST', '/enrollments', tokens.admin, { userId: 'nope', courseId: t.courses.design.id })).status, 404);
    const list = await t.request('GET', '/enrollments', tokens.admin);
    assert.ok(list.body.some((e) => e.user.email === 'student2@test.ke' && e.course.slug === 'design'));
    const dash = await t.request('GET', '/learning', tokens.student2);
    assert.equal(dash.body[0].course.slug, 'design');
  });

  it('assigns and removes tutors; only staff can be tutors', async () => {
    const path = `/courses/${t.courses.design.id}/instructors`;
    assert.equal((await t.request('POST', path, tokens.admin, { userId: t.users.student.id })).status, 400);
    assert.equal((await t.request('POST', path, tokens.tutor, { userId: t.users.tutor.id })).status, 403);
    assert.equal((await t.request('POST', path, tokens.admin, { userId: t.users.tutor.id })).status, 204);
    assert.equal((await t.request('GET', '/teach/courses/design', tokens.tutor)).status, 200);
    assert.equal((await t.request('DELETE', `${path}/${t.users.tutor.id}`, tokens.admin)).status, 204);
    assert.equal((await t.request('GET', '/teach/courses/design', tokens.tutor)).status, 403);
  });

  it('summarises the platform', async () => {
    const res = await t.request('GET', '/stats', tokens.admin);
    assert.equal(res.status, 200);
    assert.equal(res.body.courses, 2);
    assert.equal(res.body.enrollments, 2);
    assert.equal(res.body.usersByRole.ADMIN, 1);
    assert.equal(res.body.usersByRole.MENTOR, 1);
  });
});
