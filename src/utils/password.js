const { randomBytes, scrypt: scryptCb, timingSafeEqual } = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(scryptCb);
const KEYLEN = 64;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

// Stored as "salt:hash" (hex) — the format existing LMS accounts already use.
async function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(plain, salt, KEYLEN);
  return `${salt}:${derived.toString('hex')}`;
}

// Compared against when the account doesn't exist, so a failed login takes
// about as long whether or not the email is registered.
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(KEYLEN * 2)}`;

async function verifyPassword(plain, stored) {
  const [salt, hash] = (stored && stored.includes(':') ? stored : DUMMY_HASH).split(':');
  const expected = Buffer.from(hash, 'hex');
  const derived = await scrypt(plain, salt, KEYLEN);
  return Boolean(stored) && expected.length === derived.length && timingSafeEqual(expected, derived);
}

function passwordProblem(plain) {
  if (typeof plain !== 'string') return 'Password is required.';
  if (plain.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (plain.length > MAX_PASSWORD_LENGTH) return 'Password is too long.';
  return null;
}

module.exports = { hashPassword, verifyPassword, passwordProblem, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH };
