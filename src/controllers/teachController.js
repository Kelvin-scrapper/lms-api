const fs = require('fs');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Resource = require('../models/Resource');
const { saveFile, guessKind } = require('../utils/storage');

// Each loader replies 404/403 itself and returns null when the request should stop.
async function guard(req, res, courseId) {
  if (await Course.canEdit(req.user, courseId)) return true;
  res.status(403).json({ error: 'You are not a tutor on this course.' });
  return false;
}

async function loadModule(req, res) {
  const mod = await Module.findById(req.params.id);
  if (!mod) return void res.status(404).json({ error: 'Module not found' });
  return (await guard(req, res, mod.courseId)) ? mod : null;
}

async function loadLesson(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return void res.status(404).json({ error: 'Lesson not found' });
  return (await guard(req, res, lesson.module.courseId)) ? lesson : null;
}

async function list(req, res) {
  res.json(await Course.listTeachable(req.user));
}

async function detail(req, res) {
  const course = await Course.findTreeBySlug(req.params.slug);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (!(await guard(req, res, course.id))) return;
  res.json(course);
}

async function createModule(req, res) {
  if (!(await Course.findById(req.params.courseId))) return res.status(404).json({ error: 'Course not found' });
  if (!(await guard(req, res, req.params.courseId))) return;
  res.status(201).json(await Module.create(req.params.courseId, req.body.title));
}

async function renameModule(req, res) {
  const mod = await loadModule(req, res);
  if (mod) res.json(await Module.rename(mod.id, req.body.title));
}

async function deleteModule(req, res) {
  const mod = await loadModule(req, res);
  if (!mod) return;
  await Module.remove(mod.id);
  res.status(204).send();
}

async function moveModule(req, res) {
  const mod = await loadModule(req, res);
  if (!mod) return;
  await Module.move(mod, req.body.direction);
  res.status(204).send();
}

async function createLesson(req, res) {
  const mod = await loadModule(req, res);
  if (mod) res.status(201).json(await Lesson.create(mod.id, req.body.title));
}

async function updateLesson(req, res) {
  const lesson = await loadLesson(req, res);
  if (lesson) res.json(await Lesson.update(lesson.id, req.body));
}

async function deleteLesson(req, res) {
  const lesson = await loadLesson(req, res);
  if (!lesson) return;
  await Lesson.remove(lesson.id);
  res.status(204).send();
}

async function moveLesson(req, res) {
  const lesson = await loadLesson(req, res);
  if (!lesson) return;
  await Lesson.move(lesson, req.body.direction);
  res.status(204).send();
}

async function addResourceLink(req, res) {
  const lesson = await loadLesson(req, res);
  if (lesson) res.status(201).json(await Resource.create(lesson.id, req.body));
}

async function uploadResource(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.', field: 'file' });
  const lesson = await loadLesson(req, res);
  if (!lesson) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return;
  }

  const url = await saveFile({
    tempPath: req.file.path,
    originalName: req.file.originalname,
    contentType: req.file.mimetype,
    prefix: `lessons/${lesson.id}`,
  });
  const title = String(req.body?.title ?? '').trim().slice(0, 200) || req.file.originalname;
  const resource = await Resource.create(lesson.id, {
    title,
    url,
    kind: guessKind(req.file.originalname),
    sizeBytes: req.file.size,
  });
  res.status(201).json(resource);
}

async function deleteResource(req, res) {
  const resource = await Resource.findById(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  if (!(await guard(req, res, resource.lesson.module.courseId))) return;
  await Resource.remove(resource.id);
  res.status(204).send();
}

module.exports = {
  list,
  detail,
  createModule,
  renameModule,
  deleteModule,
  moveModule,
  createLesson,
  updateLesson,
  deleteLesson,
  moveLesson,
  addResourceLink,
  uploadResource,
  deleteResource,
};
