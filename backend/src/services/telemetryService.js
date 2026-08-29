const { getDb } = require('../config/database');
const { metricsRegistry } = require('../config/telemetry');


let _simulatedFault = null;
let _faultModule = null;
let _chaosMode = false;
let _chaosInterval = null;

function setSimulatedFault(type, targetModule = null) {
  _simulatedFault = type;
  _faultModule = targetModule || (type === 'SERVICE_CRASH' ? 'core-service' : null);
  
  console.log(`[Telemetry] Fault INJECTED: ${type} (Target: ${_faultModule || 'GLOBAL'})`);

  const messages = {
    'CPU_SPIKE': 'High CPU saturation detected in processing pool',
    'MEMORY_LEAK': 'Heap allocation climbing rapidly - potential memory leak',
    'LATENCY_DEGRADATION': 'Network ingress degradation - latency spikes detected',
    'SERVICE_CRASH': 'Critical process failure - core-service is unreachable'
  };

  storeErrorLog({
    module: _faultModule || 'core-service',
    message: messages[type] || `Fault detected: ${type}`,
    level: type === 'SERVICE_CRASH' ? 'ERROR' : 'WARNING'
  });
}

function clearSimulatedFaults() {
  if (_simulatedFault) {
    storeErrorLog({
      module: _faultModule || 'core-service',
      message: `Self-healing SUCCESS - Root cause [${_simulatedFault}] resolved for [${_faultModule || 'System'}]`,
      level: 'INFO'
    });
  }
  _simulatedFault = null;
  _faultModule = null;
  console.log('[Telemetry] Faults CLEARED');
}

function setChaosMode(enabled) {
  _chaosMode = enabled;
  if (enabled && !_chaosInterval) {
    console.log('[Chaos] Chaos Mode ENABLED');
    _chaosInterval = setInterval(() => {
      // 25% chance to inject a fault every 12 seconds if nothing is active
      if (!_simulatedFault && Math.random() < 0.25) {
        const types = ['CPU_SPIKE', 'MEMORY_LEAK', 'LATENCY_DEGRADATION', 'SERVICE_CRASH'];
        const type = types[Math.floor(Math.random() * types.length)];
        const modules = ['api-gateway', 'auth-service', 'payment-worker', 'db-layer', 'cache-node'];
        const mod = modules[Math.floor(Math.random() * modules.length)];
        console.log(`[Chaos] Auto-injecting random fault: ${type} → ${mod}`);
        setSimulatedFault(type, mod);
      }
    }, 12000);
  } else if (!enabled && _chaosInterval) {
    console.log('[Chaos] Chaos Mode DISABLED');
    clearInterval(_chaosInterval);
    _chaosInterval = null;
    clearSimulatedFaults();
  }
}

function getChaosMode() {
  return _chaosMode;
}

// ── CPU usage tracker (rolling average) ───────────────────────
let _lastCpuUsage = process.cpuUsage();
let _lastTime = process.hrtime.bigint();

/**
 * Returns CPU usage as a percentage (0–100) since the last call.
 */
function getCpuPercent() {
  const now = process.hrtime.bigint();
  const current = process.cpuUsage(_lastCpuUsage);
  const elapsed = Number(now - _lastTime) / 1e6; // ms

  _lastCpuUsage = process.cpuUsage();
  _lastTime = now;

  // user + system micro-seconds → percentage
  const totalMicros = current.user + current.system;
  const pct = (totalMicros / (elapsed * 1000)) * 100;
  return Math.min(pct, 100).toFixed(2);
}

// ── Memory snapshot ───────────────────────────────────────────
function getMemorySnapshot() {
  const m = process.memoryUsage();
  return {
    heapUsedMB: (m.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (m.heapTotal / 1024 / 1024).toFixed(2),
    rssMB: (m.rss / 1024 / 1024).toFixed(2),
    externalMB: ((m.external || 0) / 1024 / 1024).toFixed(2)
  };
}

// ── Build a full telemetry sample ────────────────────────────
function buildSample(extraLatency = null) {
  const baseCpu = Number(getCpuPercent());
  const baseMem = getMemorySnapshot();
  let latency = extraLatency !== null ? extraLatency : (30 + Math.random() * 40);

  // Apply simulated fault inflation
  let cpu = baseCpu;
  let mem = { ...baseMem };

  if (_simulatedFault === 'CPU_SPIKE') {
    cpu = Math.min(cpu + 70 + Math.random() * 20, 99.5);
  } else if (_simulatedFault === 'MEMORY_LEAK') {
    // String to number, inflate, number to string (to keep schema consistent)
    const inflated = (parseFloat(mem.heapUsedMB) + 250 + Math.random() * 50).toFixed(2);
    mem.heapUsedMB = inflated;
  } else if (_simulatedFault === 'LATENCY_DEGRADATION') {
    latency += 450 + Math.random() * 500;
  }

  return {
    timestamp: new Date().toISOString(),
    cpuPercent: cpu,
    memory: mem,
    latencyMs: latency,
    pid: process.pid,
    uptime: process.uptime().toFixed(1),
    faultActive: _simulatedFault,
    faultModule: _faultModule
  };
}

// ── Persist a telemetry sample ────────────────────────────────
async function storeTelemetrySample(sample) {
  const db = await getDb();
  const col = db.collection('telemetry_samples');
  await col.insertOne({ ...sample });

  // Update Prometheus gauge
  metricsRegistry.gauge('selfheal_cpu_percent').set(sample.cpuPercent);
  metricsRegistry.gauge('selfheal_memory_heap_mb').set(Number(sample.memory.heapUsedMB));

  // ── Automated Failure Detection ──
  checkThresholds(sample);

  return sample;
}

/**
 * Monitors real-time metrics and triggers self-healing workflows
 */
async function checkThresholds(sample) {
  const healingService = require('./healingService');
  
  const thresholds = {
    cpu: 85,
    mem: 180,
    lat: 400
  };

  const isAnomalous = 
    sample.cpuPercent > thresholds.cpu || 
    parseFloat(sample.memory.heapUsedMB) > thresholds.mem ||
    sample.latencyMs > thresholds.lat ||
    sample.faultActive === 'SERVICE_CRASH';

  if (isAnomalous) {
    console.log(`[Telemetry] ANOMALY DETECTED: CPU=${sample.cpuPercent}%, MEM=${sample.memory.heapUsedMB}MB, LAT=${sample.latencyMs.toFixed(0)}ms`);
    
    // Pass the anomaly window to the healing controller
    const recentSamples = await getRecentSamples(30);
    healingService.remediate(recentSamples);
  }
}

// ── Ingest an error-log entry ─────────────────────────────────
async function storeErrorLog(logEntry) {
  const db = await getDb();
  const col = db.collection('error_logs');
  const doc = {
    timestamp: logEntry.timestamp || new Date().toISOString(),
    level: logEntry.level || 'ERROR',
    module: logEntry.module || 'unknown',
    message: logEntry.message || '',
    stack: logEntry.stack || null,
    metadata: logEntry.metadata || {}
  };
  await col.insertOne(doc);
  metricsRegistry.counter('selfheal_errors_total').inc();
  return doc;
}

// ── Retrieve recent samples (for dashboard) ──────────────────
async function getRecentSamples(limit = 60) {
  const db = await getDb();
  const col = db.collection('telemetry_samples');
  return col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
}

// ── Retrieve recent error logs ────────────────────────────────
async function getRecentErrors(limit = 20) {
  const db = await getDb();
  const col = db.collection('error_logs');
  return col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
}

function getActiveFault() {
  return _simulatedFault;
}

module.exports = {
  buildSample,
  storeTelemetrySample,
  storeErrorLog,
  getRecentSamples,
  getRecentErrors,
  getCpuPercent,
  getMemorySnapshot,
  setSimulatedFault,
  getActiveFault,
  clearSimulatedFaults,
  setChaosMode,
  getChaosMode
};
