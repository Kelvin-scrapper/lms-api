const User = require('../models/User');
const LoginToken = require('../models/LoginToken');
const RevokedToken = require('../models/RevokedToken');
const { signAccessToken } = require('../utils/jwt');
const { hashPassword, verifyPassword, passwordProblem } = require('../utils/password');
const mailer = require('../utils/email');

function session(user) {
  const { token, expiresAt } = signAccessToken(user);
  return { user: User.toPublic(user), token, expiresAt };
}

function frontendUrl() {
  return (process.env.APP_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findByEmail(email);
  // Always runs, so response time doesn't reveal whether the email exists.
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    console.warn(`[auth] failed login (${user ? 'wrong password' : 'unknown email'}) for ${JSON.stringify(email)} from ${req.ip}`);
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  // Only reachable with the right password, so it reveals nothing to a guesser.
  if (!user.active) {
    return res.status(403).json({ error: 'Your account is suspended. Contact your administrator.' });
  }

  res.json(session(user));
}

async function logout(req, res) {
  const { jti, exp } = req.tokenMeta;
  await RevokedToken.revoke(jti, new Date(exp * 1000));
  res.status(204).send();
}

async function me(req, res) {
  res.json(User.toPublic(req.user));
}

async function updateMe(req, res) {
  res.json(await User.update(req.user.id, { name: req.body.name }));
}

async function changePassword(req, res) {
  const { current, next } = req.body;
  if (req.user.passwordHash && !(await verifyPassword(current, req.user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect.', field: 'current' });
  }
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem, field: 'next' });

  await User.update(req.user.id, { passwordHash: await hashPassword(next) });
  res.status(204).send();
}

// Accounts are admin-provisioned, so the reply is the same whether or not the
// email has an account.
async function requestMagicLink(req, res) {
  const { email } = req.body;
  const user = await User.findByEmail(email);

  if (user && user.active) {
    const token = await LoginToken.issue(user.email);
    const url = `${frontendUrl()}/api/auth/verify?token=${token}&email=${encodeURIComponent(user.email)}`;
    try {
      await mailer.sendEmail({
        to: user.email,
        subject: 'Your Summertech sign-in link',
        text: `Hi${user.name ? ' ' + user.name : ''},\n\nClick to sign in to the Summertech LMS (valid for ${LoginToken.TTL_MINUTES} minutes):\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
      });
    } catch (err) {
      console.error('[auth] magic link email failed:', err);
      return res.status(502).json({ error: 'Could not send the link. Try again shortly.' });
    }
  }

  res.status(202).json({ message: 'If that email has an account, a sign-in link is on its way.' });
}

async function verifyMagicLink(req, res) {
  const { email, token } = req.body;
  const invalid = () => res.status(400).json({ error: 'That sign-in link was invalid or has expired.' });

  if (!(await LoginToken.consume(email, token))) return invalid();
  const user = await User.findByEmail(email);
  if (!user || !user.active) return invalid();

  const verified = await User.markEmailVerified(user.id);
  res.json(session(verified));
}

module.exports = { login, logout, me, updateMe, changePassword, requestMagicLink, verifyMagicLink };
