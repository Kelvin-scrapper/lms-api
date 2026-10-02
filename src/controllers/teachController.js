const fs = require('fs');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Resource = require('../models/Resource');
const storage = require('../utils/storage');

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

  const url = await storage.saveFile({
    tempPath: req.file.path,
    originalName: req.file.originalname,
    contentType: req.file.mimetype,
    prefix: `lessons/${lesson.id}`,
  });
  const title = String(req.body?.title ?? '').trim().slice(0, 200) || req.file.originalname;
  const resource = await Resource.create(lesson.id, {
    title,
    url,
    kind: storage.guessKind(req.file.originalname),
    sizeBytes: req.file.size,
  });
  res.status(201).json(resource);
}

const MAX_DIRECT_UPLOAD_MB = Number(process.env.MAX_DIRECT_UPLOAD_MB) || 500;

// Step 1 of a direct upload: permission to put one file in this lesson's folder.
async function uploadUrl(req, res) {
  const lesson = await loadLesson(req, res);
  if (!lesson) return;
  if (!storage.blobConfigured()) {
    return res.status(501).json({ error: 'Direct uploads need Blob storage (BLOB_READ_WRITE_TOKEN).', fallback: 'proxy' });
  }
  if (req.body.size > MAX_DIRECT_UPLOAD_MB * 1024 * 1024) {
    return res.status(413).json({ error: `File is larger than ${MAX_DIRECT_UPLOAD_MB} MB.` });
  }
  res.json(
    await storage.createUploadToken({
      prefix: `lessons/${lesson.id}`,
      filename: req.body.filename,
      maxBytes: MAX_DIRECT_UPLOAD_MB * 1024 * 1024,
    })
  );
}

// Step 2: record the uploaded file. Only files that really exist in this
// lesson's storage folder are accepted, with their size read from storage.
async function registerUpload(req, res) {
  const lesson = await loadLesson(req, res);
  if (!lesson) return;
  if (!storage.blobConfigured()) return res.status(501).json({ error: 'Blob storage is not configured.' });

  let blob;
  try {
    blob = await storage.describeUploadedBlob(req.body.url);
  } catch {
    return res.status(400).json({ error: "That upload wasn't found. Try uploading again.", field: 'url' });
  }
  if (!blob.pathname.startsWith(`lessons/${lesson.id}/`)) {
    return res.status(400).json({ error: "That file doesn't belong to this lesson.", field: 'url' });
  }

  const fileName = blob.pathname.split('/').pop().replace(/^[0-9a-f-]{36}-/, '');
  const resource = await Resource.create(lesson.id, {
    title: req.body.title || fileName,
    url: blob.url,
    kind: storage.guessKind(fileName),
    sizeBytes: blob.size,
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
  uploadUrl,
  registerUpload,
  deleteResource,
};
