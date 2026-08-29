
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');

// ── Safety constants ──────────────────────────────────────────
const MIN_CONFIDENCE = 0.60; // Lowered from 0.75 for faster response
const MAX_PATCH_LINES = 50;
const TWIN_SUCCESS_RATE = 0.95;
const COOLDOWN_MS = 60_000; // 1 minute between patches on same module

// ── 1. PATCH RULE ENGINE ──────────────────────────────────────
const PATCH_RULES = {
  MEMORY_LEAK: {
    strategy: 'GARBAGE_COLLECTION_FLUSH',
    description: 'Trigger immediate heap cleanup and schedule a warm-restart of the process.',
    action: 'Clear Cache & Restart Process',
    patchLines: [
      '// [AUTO-PATCH] Triggering process.restart() with cache flush',
      'const cache = require("./cache"); cache.clear();',
      'process.emit("SIGUSR1"); // Trigger reload'
    ],
    riskLevel: 'LOW'
  },
  CPU_SPIKE: {
    strategy: 'RESCALE_HORIZONTAL',
    description: 'Automatically scale the microservice cluster to handle high execution load.',
    action: 'Horizontal Scaling (k8s)',
    patchLines: [
      '// [AUTO-PATCH] Scaling deployment via HPA/K8s API',
      'kubectl.scale("deployment/inventory-service", replicas=3)'
    ],
    riskLevel: 'LOW'
  },
  LATENCY_DEGRADATION: {
    strategy: 'TRAFFIC_REROUTE',
    description: 'Reroute traffic to a healthy availability zone or secondary instance.',
    action: 'Reroute Traffic',
    patchLines: [
      '// [AUTO-PATCH] Rerouting gateway traffic to Zone-B',
      'gateway.reroute({ target: "secondary-zone", weight: 1.0 })'
    ],
    riskLevel: 'MEDIUM'
  },
  SERVICE_CRASH: {
    strategy: 'SERVICE_AUTO_RECOVERY',
    description: 'Restart the failed container and reconcile state across the cluster.',
    action: 'Auto-Restart Service',
    patchLines: [
      '// [AUTO-PATCH] K8s Liveness Probe Failure - Restarting Pod',
      'api.v1.deletePod(podName); // Force reconciliation'
    ],
    riskLevel: 'HIGH'
  },
  NONE: {
    strategy: 'NO_OP',
    description: 'No patch required — system is healthy.',
    action: 'Monitor Baseline',
    patchLines: [],
    riskLevel: 'NONE'
  }
};

function selectRule(failureType) {
  return PATCH_RULES[failureType] || PATCH_RULES['NONE'];
}

function generatePatch(prediction, rcaResult) {
  const failureType = prediction.predictedFailureType || 'NONE';
  const rule = selectRule(failureType);
  const module = rcaResult.rootCause || 'unknown';

  return {
    patchId: uuidv4(),
    timestamp: new Date().toISOString(),
    module,
    failureType,
    strategy: rule.strategy,
    description: rule.description,
    patchLines: rule.patchLines,
    riskLevel: rule.riskLevel,
    confidence: prediction.confidence,
    status: 'PENDING'
  };
}

async function validateInTwin(patch) {
  // Simulate network + container-spin latency
  await new Promise(r => setTimeout(r, 1200));

  // Simulate test results
  const testCount = 100;
  const failCount = patch.riskLevel === 'MEDIUM' ? 3 : 1;
  const passRate = (testCount - failCount) / testCount;
  const passed = passRate >= TWIN_SUCCESS_RATE;

  return {
    twinValidation: {
      passed,
      testsRun: testCount,
      testsPassed: testCount - failCount,
      passRate: passRate.toFixed(3),
      latencyP95: (Math.random() * 80 + 20).toFixed(1) + 'ms',
      errors: passed ? [] : [`${failCount} tests failed in shadow environment`]
    }
  };
}

// ── 4. DEPLOY ─────────────────────────────────────────────────
/**
 * Deploys a validated patch: updates status in DB and injects
 * the patch lines into the runtime middleware registry.
 */
async function deployPatch(patch) {
  const db = await getDb();
  const col = db.collection('patches');

  patch.status = 'LIVE';
  patch.deployedAt = new Date().toISOString();
  await col.insertOne(patch);

  // Clear simulated faults so the metrics return to normal
  const { clearSimulatedFaults } = require('./telemetryService');
  clearSimulatedFaults();

  console.log(`[Patch] DEPLOYED patch ${patch.patchId} on module "${patch.module}"`);
  return patch;
}

// ── 5. ROLLBACK ───────────────────────────────────────────────
/**
 * Rolls back the most recent LIVE patch on a given module.
 */
async function rollbackPatch(patchId) {
  const db = await getDb();
  const col = db.collection('patches');

  // In a real system we'd reverse the middleware injection.
  // Here we just update the record.
  const allPatches = await col.find({}).sort({}).limit(500).toArray();
  const target = allPatches.find(p => p.patchId === patchId && p.status === 'LIVE');

  if (!target) {
    return { error: `No LIVE patch with id ${patchId}` };
  }

  target.status = 'ROLLED_BACK';
  target.rolledBackAt = new Date().toISOString();

  // Re-insert updated (simple approach for in-memory store)
  await col.insertOne({ ...target, _rolledBack: true });

  console.log(`[Patch] ROLLED BACK patch ${patchId}`);
  return target;
}

// ── FULL PIPELINE: predict → RCA → patch → validate → deploy ─
async function runPatchPipeline(prediction, rcaResult) {
  // Safety gate 1: confidence
  if (prediction.confidence < MIN_CONFIDENCE) {
    return { skipped: true, reason: `Confidence ${prediction.confidence} < ${MIN_CONFIDENCE}` };
  }

  // Safety gate 2: no-action if healthy
  if (prediction.predictedFailureType === 'NONE') {
    return { skipped: true, reason: 'System healthy — no patch needed' };
  }

  // Generate
  const patch = generatePatch(prediction, rcaResult);

  // Safety gate 3: patch size
  if (patch.patchLines.length > MAX_PATCH_LINES) {
    patch.status = 'REJECTED';
    return { ...patch, reason: 'Patch exceeds max line limit' };
  }

  // Validate in twin
  patch.status = 'VALIDATING';
  const twinResult = await validateInTwin(patch);
  Object.assign(patch, twinResult);

  if (!patch.twinValidation.passed) {
    patch.status = 'VALIDATION_FAILED';
    return patch;
  }

  patch.status = 'VALIDATED';

  // Safety gate 4: cooldown check
  const db = await getDb();
  const col = db.collection('patches');
  const recent = await col.find({}).sort({}).limit(500).toArray();
  const lastOnModule = recent
    .filter(p => p.module === patch.module && p.status === 'LIVE')
    .sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt))[0];

  if (lastOnModule) {
    const elapsed = Date.now() - new Date(lastOnModule.deployedAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      patch.status = 'COOLDOWN';
      return { ...patch, reason: `Cooldown: last patch on "${patch.module}" was ${(elapsed / 1000).toFixed(0)}s ago` };
    }
  }

  // Deploy
  return deployPatch(patch);
}

// ── Retrieve patch history ────────────────────────────────────
async function getPatchHistory(limit = 30) {
  const db = await getDb();
  const col = db.collection('patches');
  return col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
}

async function clearPatchHistory() {
  const db = await getDb();
  const col = db.collection('patches');
  await col.deleteMany({});
  console.log('[Patch] History CLEARED');
}

module.exports = {
  generatePatch,
  validateInTwin,
  deployPatch,
  rollbackPatch,
  runPatchPipeline,
  getPatchHistory,
  clearPatchHistory,
  selectRule,
  PATCH_RULES
};
