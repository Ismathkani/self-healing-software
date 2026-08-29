
const http = require('http');

const HOST = process.env.BACKEND_HOST || 'localhost';
const PORT = process.env.BACKEND_PORT || 3001;

let passed = 0, failed = 0;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: HOST, port: PORT, path, method,
        headers: { 'Content-Type': 'application/json' }
      },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch (e) { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name} — ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Self-Heal Backend — API Validation Tests');
  console.log('═══════════════════════════════════════════════\n');

  // ── 1. Health endpoints ─────────────────────────────────
  console.log('[1] Health Endpoints');
  let r;

  r = await request('GET', '/api/health/live');
  assert('GET /health/live → 200', r.status === 200);
  assert('  has status: alive', r.body.status === 'alive');

  r = await request('GET', '/api/health/ready');
  assert('GET /health/ready → 200', r.status === 200);

  r = await request('GET', '/api/health/info');
  assert('GET /health/info → 200', r.status === 200);
  assert('  has service name', r.body.service === 'self-heal-backend');

  // ── 2. Telemetry endpoints ──────────────────────────────
  console.log('\n[2] Telemetry Endpoints');

  r = await request('GET', '/api/telemetry/snapshot');
  assert('GET /telemetry/snapshot → 200', r.status === 200);
  assert('  has cpuPercent', typeof r.body.cpuPercent === 'number');
  assert('  has memory object', typeof r.body.memory === 'object');

  r = await request('POST', '/api/telemetry/sample', {
    timestamp: new Date().toISOString(),
    cpuPercent: 42.5,
    memory: { heapUsedMB: '95.3', heapTotalMB: '180.0', rssMB: '110.2', externalMB: '2.1' },
    latencyMs: 67
  });
  assert('POST /telemetry/sample → 201', r.status === 201);
  assert('  returns cpuPercent', r.body.cpuPercent === 42.5);

  r = await request('POST', '/api/telemetry/error', {
    level: 'ERROR',
    module: 'test-module',
    message: 'Unit test error injection',
    stack: 'Error: test\n    at test.js:1'
  });
  assert('POST /telemetry/error → 201', r.status === 201);
  assert('  returns module name', r.body.module === 'test-module');

  r = await request('GET', '/api/telemetry/history?limit=5');
  assert('GET /telemetry/history → 200', r.status === 200);
  assert('  returns samples array', Array.isArray(r.body.samples));

  r = await request('GET', '/api/telemetry/errors?limit=5');
  assert('GET /telemetry/errors → 200', r.status === 200);
  assert('  returns errors array', Array.isArray(r.body.errors));

  // ── 3. Prediction endpoints ─────────────────────────────
  console.log('\n[3] Prediction Endpoints');

  r = await request('GET', '/api/predict/latest');
  assert('GET /predict/latest → 200', r.status === 200);
  assert('  has failureProbability', 'failureProbability' in r.body);

  r = await request('POST', '/api/predict/run');
  assert('POST /predict/run → 200', r.status === 200);
  assert('  has predictedFailureType', typeof r.body.predictedFailureType === 'string');

  r = await request('POST', '/api/predict/rca', { windowMs: 60000 });
  assert('POST /predict/rca → 200', r.status === 200);
  assert('  has rootCause', 'rootCause' in r.body);

  // ── 4. Patch endpoints ──────────────────────────────────
  console.log('\n[4] Patch Endpoints');

  r = await request('POST', '/api/patches/auto');
  assert('POST /patches/auto → 200', r.status === 200);
  // May be skipped or deployed depending on state
  assert('  has status or skipped', r.body.status || r.body.skipped);

  r = await request('GET', '/api/patches/history');
  assert('GET /patches/history → 200', r.status === 200);
  assert('  returns patches array', Array.isArray(r.body.patches));

  // ── 5. 404 handling ─────────────────────────────────────
  console.log('\n[5] Error Handling');

  r = await request('GET', '/api/nonexistent');
  assert('GET /nonexistent → 404', r.status === 404);

  // ── Summary ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('═══════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[Test] FATAL — backend not reachable:', err.message);
  console.error('       Make sure the backend is running: cd backend && npm start');
  process.exit(1);
});
