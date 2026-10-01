// Applies db/schema.prisma to DATABASE_URL. Safe to run on every start: it
// only adds what's missing, and refuses (rather than silently dropping data)
// if a change would lose data.
require('dotenv').config({ quiet: true });
const { execFileSync } = require('child_process');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
  stdio: 'inherit',
  env: process.env,
});
