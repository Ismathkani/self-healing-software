

const express = require('express');
const router  = express.Router();
const { runPatchPipeline, getPatchHistory, rollbackPatch, clearPatchHistory } = require('../services/patchService');
const { getLastPrediction }   = require('../services/predictionService');
const { analyzeRootCause }    = require('../services/rootCauseService');

// ── POST /auto — full pipeline ────────────────────────────────
router.post('/auto', async (req, res, next) => {
  try {
    const prediction = getLastPrediction();
    const rca        = await analyzeRootCause();
    const result     = await runPatchPipeline(prediction, rca);
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /history ───────────────────────────────────────────────
router.get('/history', async (req, res, next) => {
  try {
    const limit   = Math.min(parseInt(req.query.limit) || 30, 200);
    const patches = await getPatchHistory(limit);
    res.json({ count: patches.length, patches });
  } catch (err) { next(err); }
});

// ── POST /rollback ────────────────────────────────────────────
router.post('/rollback', async (req, res, next) => {
  try {
    const { patchId } = req.body;
    if (!patchId) return res.status(400).json({ error: 'patchId is required' });
    const result = await rollbackPatch(patchId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/clear', async (req, res, next) => {
  try {
    await clearPatchHistory();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
