const { rateLimit } = require('express-rate-limit');

// In-memory, so limits reset on restart and aren't shared between instances.
// With several API instances, swap in a shared store (e.g. Redis). Behind a
// reverse proxy set TRUST_PROXY so limits apply per real client.
function limiter({ windowMinutes, limit, skipSuccessfulRequests, message }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfterSeconds = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: message, retryAfterSeconds });
    },
  });
}

// 10 failed sign-ins per IP per 15 minutes; successful ones don't count.
const loginRateLimit = limiter({
  windowMinutes: 15,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many failed sign-in attempts. Please try again later.',
});

// Every request sends an email, so these count whether or not they succeed.
const magicLinkRateLimit = limiter({
  windowMinutes: 15,
  limit: 5,
  skipSuccessfulRequests: false,
  message: 'Too many sign-in link requests. Please try again later.',
});

module.exports = { loginRateLimit, magicLinkRateLimit };
