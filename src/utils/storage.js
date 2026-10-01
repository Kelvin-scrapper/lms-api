const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Two backends: Vercel Blob when BLOB_READ_WRITE_TOKEN is set (shared by every
// API instance, so it scales horizontally), otherwise the local UPLOAD_DIR
// served by GET /files/:key (fine for one server with a persistent volume).

function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

function publicBaseUrl() {
  return (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
}

function safeName(name) {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120);
}

// Moves an uploaded temp file into storage and returns its public URL.
async function saveFile({ tempPath, originalName, contentType, prefix }) {
  const name = safeName(originalName);
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = require('@vercel/blob');
      const blob = await put(`${prefix}/${Date.now()}-${name}`, fs.createReadStream(tempPath), {
        access: 'public',
        addRandomSuffix: false,
        contentType,
      });
      return blob.url;
    }

    const key = `${crypto.randomUUID()}-${name}`;
    fs.mkdirSync(uploadDir(), { recursive: true });
    // copy rather than rename: the temp dir may be on another filesystem/volume.
    await fs.promises.copyFile(tempPath, path.join(uploadDir(), key));
    return `${publicBaseUrl()}/files/${encodeURIComponent(key)}`;
  } finally {
    fs.promises.unlink(tempPath).catch(() => {});
  }
}

// Resolves a /files/:key request to a path inside UPLOAD_DIR, or null.
function localFilePath(key) {
  const full = path.join(uploadDir(), path.basename(key));
  return fs.existsSync(full) ? full : null;
}

function guessKind(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'ogg', 'm4v'].includes(ext)) return 'VIDEO';
  if (ext === 'pdf') return 'PDF';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'SLIDES';
  return 'OTHER';
}

module.exports = { saveFile, localFilePath, guessKind };
