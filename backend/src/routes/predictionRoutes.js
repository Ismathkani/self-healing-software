
const express = require('express');
const router  = express.Router();
const { predict, getLastPrediction }  = require('../services/predictionService');
const { getRecentSamples }            = require('../services/telemetryService');
const { analyzeRootCause }            = require('../services/rootCauseService');

// ── POST /run — full prediction cycle ────────────────────────
router.post('/run', async (req, res, next) => {
  try {
    // Grab the last 30 samples as the sliding window
    const samples   = await getRecentSamples(30);
    const prediction = await predict(samples);
    res.json(prediction);
  } catch (err) { next(err); }
});

// ── GET /latest — cached prediction ───────────────────────────
router.get('/latest', (req, res) => {
  res.json(getLastPrediction());
});

// ── POST /rca — root cause analysis ───────────────────────────
router.post('/rca', async (req, res, next) => {
  try {
    const windowMs = parseInt(req.body && req.body.windowMs) || 60000;
    const result   = await analyzeRootCause(windowMs);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
