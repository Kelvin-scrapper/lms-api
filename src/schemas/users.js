const { z } = require('zod');
const { ROLES } = require('../models/User');
const { email } = require('./auth');

const role = z.enum(ROLES, { errorMap: () => ({ message: `Role must be one of: ${ROLES.join(', ')}.` }) });

// Password is optional: without one the person signs in with a magic link.
const createUser = z.object({
  email,
  name: z.string().trim().min(2, 'Name is too short.').max(120, 'Name is too long.'),
  role: role.default('STUDENT'),
  password: z.string().optional().transform((p) => (p ? p : undefined)),
});

const updateUser = z
  .object({ role: role.optional(), active: z.boolean().optional() })
  .refine((v) => v.role !== undefined || v.active !== undefined, 'Nothing to update.');

module.exports = { createUser, updateUser };
