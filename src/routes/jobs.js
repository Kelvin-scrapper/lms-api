const express = require('express');
const { purgeExpiredTokens } = require('../jobs/purgeExpiredTokens');

const router = express.Router();

// For schedulers on hosts without a long-running process (Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET`). Disabled unless CRON_SECRET is set.
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/purge-tokens', requireCronSecret, async (req, res) => {
  await purgeExpiredTokens();
  res.json({ ok: true });
});

module.exports = router;
