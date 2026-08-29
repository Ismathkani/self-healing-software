
const http = require('http');
const { getDb } = require('../config/database');

const AI_HOST = process.env.AI_HOST || 'localhost';
const AI_PORT = process.env.AI_PORT || 5000;

let _lastPrediction = null;

function callAiServer(samples) {
  return new Promise((resolve, reject) => {
    const flattened = samples.map(s => ({
      cpuPercent: Number(s.cpuPercent || 0),
      heapUsedMB: Number(s.memory?.heapUsedMB || 0),
      latencyMs: Number(s.latencyMs || 0),
      errorCount: Number(s.errorCount || 0)
    }));

    const body = JSON.stringify({ samples: flattened });

    const req = http.request(
      {
        hostname: AI_HOST,
        port: AI_PORT,
        path: '/predict',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(5000, () => { req.abort(); reject(new Error('AI server timeout')); });
    req.write(body);
    req.end();
  });
}


function heuristicPredict(samples) {
  const latest = samples[samples.length - 1] || {};
  const cpu = latest.cpuPercent || 0;
  const mem = Number((latest.memory || {}).heapUsedMB || 0);
  const lat = latest.latencyMs || 0;

  let failureType = 'NONE';
  let baseProb = 0.05;

  if (latest.faultActive === 'SERVICE_CRASH') {
    failureType = 'SERVICE_CRASH';
    baseProb = 0.95;
  } else if (lat > 500) {
    failureType = 'LATENCY_DEGRADATION';
    baseProb = 0.5;
  } else if (mem > 300) {
    failureType = 'MEMORY_LEAK';
    baseProb = 0.6;
  } else if (cpu > 80) {
    failureType = 'CPU_SPIKE';
    baseProb = 0.7;
  }

  // Weighted heuristic
  let prob = baseProb + (cpu / 100) * 0.2 + (mem / 512) * 0.1 + (lat / 1500) * 0.3;
  prob = Math.min(prob, 0.99).toFixed(3);

  return {
    failureProbability: Number(prob),
    confidence: 0.82,
    predictedFailureType: failureType,
    rootCauseHint: failureType !== 'NONE'
      ? `Heuristic: ${failureType} detected (Lat: ${lat.toFixed(0)}ms, CPU: ${cpu}%)`
      : 'System healthy — no anomaly detected',
    source: 'heuristic_fallback'
  };
}

/**
 * Main entry: try the AI server first; fall back to heuristic.
 */
async function predict(samples) {
  if (!samples || samples.length === 0) {
    return {
      failureProbability: 0,
      confidence: 1,
      predictedFailureType: 'NONE',
      rootCauseHint: 'Waiting for telemetry samples...',
      source: 'initial_state',
      timestamp: new Date().toISOString()
    };
  }

  let prediction;
  try {
    prediction = await callAiServer(samples);
    // If AI server returned an error detail (e.g. from FastAPI)
    if (prediction.detail) {
      throw new Error(prediction.detail);
    }
    prediction.source = 'lstm_model';
  } catch (err) {
    console.warn('[Predict] AI server error or unreachable, using heuristic:', err.message);
    prediction = heuristicPredict(samples);
  }

  // Cache for dashboard polling
  _lastPrediction = {
    ...prediction,
    timestamp: new Date().toISOString()
  };


  const db = await getDb();
  await db.collection('predictions').insertOne(_lastPrediction);

  return _lastPrediction;
}

function getLastPrediction() {
  return _lastPrediction || {
    failureProbability: 0,
    confidence: 0,
    predictedFailureType: 'NONE',
    rootCauseHint: 'No prediction yet',
    source: 'none',
    timestamp: new Date().toISOString()
  };
}

module.exports = { predict, getLastPrediction };
