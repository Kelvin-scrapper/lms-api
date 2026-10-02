// Vercel entry point: the whole Express app runs as one serverless function
// (vercel.json routes every path here). Docker/VPS uses src/index.js directly.
module.exports = require('../src/index.js');
