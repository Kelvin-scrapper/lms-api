const { z } = require('zod');
const { KINDS } = require('../models/Resource');

const id = (label) => z.string({ required_error: `${label} is required.` }).min(1, `${label} is required.`);

const title = z.string({ required_error: 'Title is required.' }).trim().min(1, 'Title is required.').max(200, 'Title is too long.');

const move = z.object({ direction: z.enum(['up', 'down']) });

const titled = z.object({ title });

const updateLesson = z.object({
  title,
  contentMarkdown: z.string().max(200_000, 'Notes are too long.').default(''),
  estMinutes: z.coerce.number().int().min(1).max(600).default(10),
});

const resourceLink = z.object({
  title,
  url: z.string().trim().url('Enter a full URL starting with http:// or https://.').refine((u) => /^https?:\/\//i.test(u), 'Only http(s) links are allowed.'),
  kind: z.enum(KINDS).default('LINK'),
});

const assignInstructor = z.object({ userId: id('Tutor') });

const enroll = z.object({ userId: id('Learner'), courseId: id('Course') });

module.exports = { move, titled, updateLesson, resourceLink, assignInstructor, enroll };
