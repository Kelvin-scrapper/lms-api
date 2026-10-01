const LoginToken = require('../models/LoginToken');
const RevokedToken = require('../models/RevokedToken');

const INTERVAL_MS = 6 * 60 * 60 * 1000;

// Used/expired magic links and revoked tokens past their expiry serve no
// purpose; without this both tables grow forever.
async function purgeExpiredTokens() {
  const [links, revoked] = await Promise.all([LoginToken.purgeStale(), RevokedToken.purgeExpired()]);
  if (links || revoked) {
    console.info(`[tokens] purged ${links} stale sign-in link(s) and ${revoked} expired revoked token(s)`);
  }
}

function startTokenPurge() {
  const run = () => purgeExpiredTokens().catch((err) => console.error('[tokens] purge failed:', err));
  run();
  setInterval(run, INTERVAL_MS).unref();
}

module.exports = { purgeExpiredTokens, startTokenPurge };
