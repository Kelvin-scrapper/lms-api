const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { verifyAccessToken } = require('../utils/jwt');

async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (await RevokedToken.isRevoked(decoded.jti)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  // Looked up on every request so suspensions and role changes apply at once.
  const user = await User.findActiveById(decoded.sub);
  if (!user) {
    return res.status(401).json({ error: 'This account is no longer active' });
  }

  req.user = user;
  req.tokenMeta = { jti: decoded.jti, exp: decoded.exp };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
