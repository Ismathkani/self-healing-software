
// ── 1. OpenTelemetry must be initialised first ────────────────
const { initTelemetry } = require('./config/telemetry');
initTelemetry(); // registers TracerProvider + PrometheusExporter

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// ── 2. Internal modules ───────────────────────────────────────
const telemetryRoutes = require('./routes/telemetryRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const patchRoutes = require('./routes/patchRoutes');
const healthRoutes = require('./routes/healthRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');

// ── 3. App bootstrap ──────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// Global request-id so every log line is traceable
app.use((req, res, next) => {
  req.requestId = uuidv4();
  next();
});

app.use(cors());                        // allow React dev-server
app.use(express.json());                // JSON body parser
app.use(requestLogger);                 // structured request logging

// ── 3a. Dynamic Patch Applicator ──────────────────────────────
const patchApplicator = require('./middleware/patchApplicator');
app.use(patchApplicator);

// ── 4. Route mounting ─────────────────────────────────────────
app.use('/api/pipeline', pipelineRoutes);   // New Pipeline Routes
app.use('/api/telemetry', telemetryRoutes);   // Legacy CPU / Memory / Latency / Logs
app.use('/api/predict', predictionRoutes);  // AI failure-prediction proxy
app.use('/api/patches', patchRoutes);       // Micro-patch CRUD + deploy
app.use('/api/health', healthRoutes);      // Liveness / readiness

// ── 5. 404 catch-all ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// ── 6. Global error handler ──────────────────────────────────
app.use(errorHandler);

// ── 7. Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SelfHeal Backend] listening on port ${PORT}`);

  // ── 7a. BACKGROUND LOOPS ──────────────────────────────────
  const { buildSample, storeTelemetrySample, getRecentSamples } = require('./services/telemetryService');
  const { predict } = require('./services/predictionService');
  const { analyzeRootCause } = require('./services/rootCauseService');
  const { runPatchPipeline } = require('./services/patchService');

  // 1. Telemetry Collection Loop (Every 1s)
  setInterval(async () => {
    try {
      const sample = buildSample();
      await storeTelemetrySample(sample);
    } catch (e) { /* ignore boot errors */ }
  }, 1000);

  // 2. Automatic Healing Loop (Driven by Healing Service)
  setInterval(async () => {
    try {
      const samples = await getRecentSamples(30);
      const healingService = require('./services/healingService');

      // The healing service handles predict -> rca -> patch -> deploy
      // and updates the "lively" metadata for the dashboard.
      await healingService.remediate(samples);
    } catch (e) {
      console.error('[Heal Loop Error]', e.message);
    }
  }, 2000);
});

module.exports = app; // exported for test harnesses
