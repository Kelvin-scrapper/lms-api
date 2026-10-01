const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Read lazily so tests can set JWT_SECRET after this module is loaded.
function secret() {
  return process.env.JWT_SECRET;
}

function signAccessToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, jti }, secret(), {
    expiresIn: EXPIRES_IN,
  });
  const { exp } = jwt.decode(token);
  return { token, jti, expiresAt: new Date(exp * 1000) };
}

function verifyAccessToken(token) {
  return jwt.verify(token, secret());
}

module.exports = { signAccessToken, verifyAccessToken };
