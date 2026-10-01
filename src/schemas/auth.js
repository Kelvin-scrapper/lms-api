const { z } = require('zod');
const { MAX_EMAIL_LENGTH } = require('../models/User');
const { MAX_PASSWORD_LENGTH } = require('../utils/password');

const email = z
  .string({ required_error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .max(MAX_EMAIL_LENGTH, 'Email is too long.')
  .email('Enter a valid email address.');

const login = z.object({
  email,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.').max(MAX_PASSWORD_LENGTH),
});

const magicLinkRequest = z.object({ email });

const magicLinkVerify = z.object({
  email,
  token: z.string().regex(/^[a-f0-9]{64}$/, 'That sign-in link is invalid.'),
});

const updateProfile = z.object({
  name: z.string().trim().min(2, 'Name is too short.').max(120, 'Name is too long.'),
});

// `current` is only checked when the account already has a password.
const changePassword = z.object({
  current: z.string().max(MAX_PASSWORD_LENGTH).optional().default(''),
  next: z.string({ required_error: 'Enter a new password.' }),
});

module.exports = { email, login, magicLinkRequest, magicLinkVerify, updateProfile, changePassword };
