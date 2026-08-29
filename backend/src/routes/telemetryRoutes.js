const express = require('express');
const router = express.Router();
const {
  buildSample,
  storeTelemetrySample,
  storeErrorLog,
  getRecentSamples,
  getRecentErrors,
  setSimulatedFault,
  clearSimulatedFaults,
  getActiveFault,
  setChaosMode,
  getChaosMode
} = require('../services/telemetryService');
const { getLastPrediction } = require('../services/predictionService');
const { getLastRca } = require('../services/rootCauseService');

// ── GET /snapshot — live system metrics ──────────────────────
router.get('/snapshot', async (req, res, next) => {
  try {
    const sample = buildSample();
    await storeTelemetrySample(sample);

    // Trigger the direct healing execution (background)
    const healingService = require('../services/healingService');
    getRecentSamples(30)
      .then(samples => healingService.remediate(samples))
      .catch(err => console.error('[Telemetry] Background healing failed', err.message));

    res.json(sample);
  } catch (err) { next(err); }
});

// ── GET /history — last N samples ─────────────────────────────
router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 60, 500);
    const samples = await getRecentSamples(limit);
    res.json({ count: samples.length, samples });
  } catch (err) { next(err); }
});

// ── POST /sample — external push ──────────────────────────────
router.post('/sample', async (req, res, next) => {
  try {
    const sample = {
      timestamp: req.body.timestamp || new Date().toISOString(),
      cpuPercent: req.body.cpuPercent || 0,
      memory: req.body.memory || {},
      latencyMs: req.body.latencyMs || null
    };
    const stored = await storeTelemetrySample(sample);
    res.status(201).json(stored);
  } catch (err) { next(err); }
});

// ── POST /error — ingest error log ────────────────────────────
router.post('/error', async (req, res, next) => {
  try {
    const doc = await storeErrorLog(req.body);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

// ── GET /errors — recent error logs ───────────────────────────
router.get('/errors', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 200);
    const errors = await getRecentErrors(limit);
    res.json({ count: errors.length, errors });
  } catch (err) { next(err); }
});

// ── POST /inject — manually trigger a fault ───────────────────
router.post('/inject', (req, res) => {
  const { type, targetModule } = req.body;
  if (!type) return res.status(400).json({ error: 'Fault type is required' });
  setSimulatedFault(type, targetModule);
  res.json({ ok: true, injected: type, target: targetModule });
});

// ── POST /clear — clear any injected fault ────────────────────
router.post('/clear', (req, res) => {
  clearSimulatedFaults();
  res.json({ ok: true });
});

// ── GET /active-fault — check if a fault is active ────────────
router.get('/active-fault', (req, res) => {
  res.json({ activeFault: getActiveFault() });
});

// ── CHAOS MODE Toggles ────────────────────────────────────────
router.get('/chaos', (req, res) => {
  res.json({ enabled: getChaosMode() });
});

router.post('/chaos', (req, res) => {
  const { enabled } = req.body;
  setChaosMode(!!enabled);
  res.json({ ok: true, chaosEnabled: !!enabled });
});

// ── GET /rca — retrieve lively root cause analysis ────────────
router.get('/rca', (req, res) => {
  const rca = getLastRca();
  res.json({
    rootCause: rca.rootCause,
    confidence: rca.confidence,
    rootCauseHint: rca.message || 'Analysis active'
  });
});


module.exports = router;
