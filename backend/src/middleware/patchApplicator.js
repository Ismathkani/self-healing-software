
const { getDb } = require('../config/database');
const rateLimit = require('express-rate-limit');

// Cache active patches to avoid hitting DB on every request
let activePatches = [];
let lastFetch = 0;
const REFRESH_INTERVAL = 2000; // ms

// Store dynamic middleware instances
const limiters = {}; 

async function refreshPatches() {
  const now = Date.now();
  if (now - lastFetch < REFRESH_INTERVAL) return;

  try {
    const db = await getDb();
    if (db) {
        // Find patches that are LIVE and NOT rolled back
        activePatches = await db.collection('patches')
        .find({ status: 'LIVE' })
        .toArray();
    }
    lastFetch = now;
  } catch (err) {
    console.error('[PatchApplicator] Failed to refresh patches', err.message);
  }
}

// ── Rate Limiter Factory ─────────────────────────────────────
function getRateLimiter(patchId) {
  if (!limiters[patchId]) {
    limiters[patchId] = rateLimit({
      windowMs: 1000, 
      max: 50, // Strict limit
      message: { error: 'Too Many Requests', patchApplied: true, patchId }
    });
  }
  return limiters[patchId];
}

module.exports = async function patchApplicator(req, res, next) {
  await refreshPatches();

  if (activePatches.length === 0) {
    return next();
  }

  // Iterate through active patches
  for (const patch of activePatches) {
    
    // 1. CPU_SPIKE -> Rate Limiter
    if (patch.failureType === 'CPU_SPIKE') {
        res.setHeader('X-Patched-LoadBalancer', patch.patchId);
        const limiter = getRateLimiter(patch.patchId);
        // Apply to all routes for simplicity in this demo, or filter by module
        return limiter(req, res, next);
    }

    // 2. LATENCY_DEGRADATION -> Timeout
    if (patch.failureType === 'LATENCY_DEGRADATION') {
        res.setHeader('X-Patched-Timeout', patch.patchId);
        // Enforce tight timeout
        res.setTimeout(2000, () => {
            if (!res.headersSent) {
                res.status(503).json({ 
                    error: 'Service Unavailable (Patched: Timeout Enforced)', 
                    patchId: patch.patchId 
                });
            }
        });
    }

    // 3. MEMORY_LEAK -> Aggressive GC (Simulated via header check)
    if (patch.failureType === 'MEMORY_LEAK') {
        // In real node, we might call global.gc() if exposed
        // Here we just add a header to indicate mitigation
        res.setHeader('X-Patch-Applied', 'MemoryLeakMitigation');
    }
  }

  next();
};
