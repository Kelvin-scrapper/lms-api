const { localFilePath } = require('../utils/storage');

// Serves uploads stored on local disk (only used when Vercel Blob isn't configured).
async function serve(req, res) {
  const file = localFilePath(req.params.key);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.sendFile(file, { maxAge: '7d', immutable: true });
}

module.exports = { serve };
