const http = require('http');

const HOST = process.env.BACKEND_HOST || 'localhost';
const PORT = process.env.BACKEND_PORT || 3001;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: HOST, port: PORT, path, method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Sample error logs (realistic module names + messages) ────
const ERROR_TEMPLATES = [
  { module: 'payment-service', level: 'ERROR', message: 'Stripe API timeout after 5000ms' },
  { module: 'order-service', level: 'ERROR', message: 'MongoDB query timed out (serverSelectionTimeoutMS)' },
  { module: 'api-gateway', level: 'WARN', message: 'Rate limit exceeded for /api/checkout — 429 returned' },
  { module: 'auth-service', level: 'ERROR', message: 'JWT verification failed — token expired' },
  { module: 'inventory-service', level: 'ERROR', message: 'Redis RESP error — connection refused' },
  { module: 'notification-service', level: 'WARN', message: 'Email send failed — SMTP connection reset' },
  { module: 'database-layer', level: 'ERROR', message: 'Connection pool exhausted — max 10 connections active' },
  { module: 'cache-layer', level: 'ERROR', message: 'Cache miss rate > 80% — TTL too short or eviction' },
  { module: 'order-service', level: 'ERROR', message: 'Deadlock detected on orders table — retry #3' },
  { module: 'payment-service', level: 'ERROR', message: 'Payment webhook signature mismatch' },
  { module: 'database-layer', level: 'ERROR', message: 'Replication lag exceeded 5s — read replica stale' },
  { module: 'api-gateway', level: 'ERROR', message: 'Upstream service health check failed — circuit opened' },
  { module: 'auth-service', level: 'ERROR', message: 'OAuth2 token refresh rate limit hit' },
  { module: 'inventory-service', level: 'WARN', message: 'Stock check latency P99 > 2000ms' },
  { module: 'payment-service', level: 'ERROR', message: 'Idempotency key collision detected' }
];

async function seedData() {
  console.log('[Seed] Starting data seeding...');

  let sampleCount = 0;
  let errorCount = 0;
  const now = Date.now();

  // ── Inject 120 telemetry samples (last 2 minutes) ──────────
  for (let i = 119; i >= 0; i--) {
    const t = new Date(now - i * 1000).toISOString();
    // Simulate a ramp in the last 30 seconds
    const inRamp = i < 30;
    const severity = inRamp ? (30 - i) / 30 : 0;

    const sample = {
      timestamp: t,
      cpuPercent: Math.round((20 + Math.random() * 10 + severity * 55) * 100) / 100,
      memory: {
        heapUsedMB: (70 + Math.random() * 15 + severity * 120).toFixed(2),
        heapTotalMB: '180.00',
        rssMB: (95 + Math.random() * 10).toFixed(2),
        externalMB: (2 + Math.random() * 3).toFixed(2)
      },
      latencyMs: Math.round(40 + Math.random() * 20 + severity * 300)
    };

    try {
      await post('/api/telemetry/sample', sample);
      sampleCount++;
    } catch (e) {
      console.error('[Seed] Failed to post sample:', e.message);
      console.error('[Seed] Is the backend running on port ' + PORT + '?');
      process.exit(1);
    }
  }

  console.log(`[Seed] Inserted ${sampleCount} telemetry samples`);

  // ── Inject error logs ─────────────────────────────────────
  for (let i = 0; i < ERROR_TEMPLATES.length; i++) {
    const tmpl = ERROR_TEMPLATES[i];
    const errDoc = {
      timestamp: new Date(now - (ERROR_TEMPLATES.length - i) * 8000).toISOString(),
      level: tmpl.level,
      module: tmpl.module,
      message: tmpl.message,
      stack: `Error: ${tmpl.message}\n    at ${tmpl.module}/index.js:${42 + i}\n    at Layer.handle [as handle]`,
      metadata: { seedRun: true }
    };

    try {
      await post('/api/telemetry/error', errDoc);
      errorCount++;
    } catch (e) {
      console.error('[Seed] Failed to post error:', e.message);
    }
  }

  console.log(`[Seed] Inserted ${errorCount} error logs`);
  console.log('[Seed] Done! Dashboard should now show populated data.');
  console.log('[Seed] Tip: POST /api/predict/run to trigger a prediction');
}

seedData();
