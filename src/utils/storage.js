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
    // Serverless hosts (e.g. Vercel) have no lasting disk to keep files on.
    if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL) {
      throw Object.assign(new Error('File storage is not configured. Set BLOB_READ_WRITE_TOKEN.'), { status: 501 });
    }
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

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const DIRECT_UPLOAD_TTL_MS = 30 * 60 * 1000;

// A short-lived token that lets a browser upload exactly one file straight to
// Blob storage, so large videos never pass through the web app or this API.
async function createUploadToken({ prefix, filename, maxBytes }) {
  const { generateClientTokenFromReadWriteToken } = require('@vercel/blob/client');
  const pathname = `${prefix}/${crypto.randomUUID()}-${safeName(filename)}`;
  const validUntil = Date.now() + DIRECT_UPLOAD_TTL_MS;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    pathname,
    maximumSizeInBytes: maxBytes,
    addRandomSuffix: false,
    validUntil,
  });
  return { pathname, clientToken, expiresAt: new Date(validUntil).toISOString() };
}

// Confirms a browser-uploaded file exists and returns its real size/path.
async function describeUploadedBlob(url) {
  const { head } = require('@vercel/blob');
  const info = await head(url);
  return { pathname: info.pathname, size: info.size, url: info.url };
}

function guessKind(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'ogg', 'm4v'].includes(ext)) return 'VIDEO';
  if (ext === 'pdf') return 'PDF';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'SLIDES';
  return 'OTHER';
}

module.exports = {
  saveFile,
  localFilePath,
  guessKind,
  blobConfigured,
  createUploadToken,
  describeUploadedBlob,
};
