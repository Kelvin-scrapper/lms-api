const Stats = require('../models/Stats');

async function summary(req, res) {
  res.json(await Stats.summary());
}

module.exports = { summary };
