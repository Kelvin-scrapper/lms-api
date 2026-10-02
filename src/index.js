require('dotenv').config({ quiet: true });

// Without this every login would fail with an opaque 500 when signing the token.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or shorter than 16 characters — refusing to start. See .env.example.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const prisma = require('./db');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const coursesRoutes = require('./routes/courses');
const learningRoutes = require('./routes/learning');
const teachRoutes = require('./routes/teach');
const enrollmentsRoutes = require('./routes/enrollments');
const statsRoutes = require('./routes/stats');
const filesRoutes = require('./routes/files');
const jobsRoutes = require('./routes/jobs');
const { startTokenPurge } = require('./jobs/purgeExpiredTokens');

const app = express();
const PORT = process.env.PORT || 4000;

// Number of reverse proxies in front of the API (e.g. 1 for nginx or a
// platform load balancer), so req.ip — which rate limits key on — is the real
// client. Leave unset when reached directly, or clients could spoof it.
const trustProxyHops = Number(process.env.TRUST_PROXY);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: allowedOrigins }));
// Lesson notes are Markdown and can be long.
app.use(express.json({ limit: '1mb' }));

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/courses', coursesRoutes);
app.use('/learning', learningRoutes);
app.use('/teach', teachRoutes);
app.use('/enrollments', enrollmentsRoutes);
app.use('/stats', statsRoutes);
app.use('/files', filesRoutes);
app.use('/jobs', jobsRoutes);

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE'
      ? res.status(413).json({ error: `File is larger than ${Number(process.env.MAX_UPLOAD_MB) || 200} MB.` })
      : res.status(400).json({ error: 'Invalid upload.' });
  }
  if (err.status === 501) {
    return res.status(501).json({ error: err.message });
  }
  // Prisma: a record changed or vanished between the check and the write.
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not found' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Tests import the app without starting the server or the purge timer.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Summertech LMS API listening on port ${PORT}`);
  });
  startTokenPurge();
}

module.exports = app;
