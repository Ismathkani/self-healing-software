const { getDb } = require('../config/database');
const telemetryService = require('../services/telemetryService');
const healingService = require('../services/healingService');

/**
 * Controller for the Self-Healing Pipeline
 */
class PipelineController {
  
  // POST /api/telemetry -> receive data
  async receiveTelemetry(req, res) {
    try {
      const db = await getDb();
      const sample = req.body;
      
      // Basic validation
      if (!sample.cpuPercent && !sample.heapUsedMB) {
        return res.status(400).json({ error: 'Invalid telemetry data' });
      }

      const doc = await db.collection('telemetry').insertOne({
        ...sample,
        timestamp: sample.timestamp || new Date().toISOString()
      });

      res.status(201).json({ success: true, id: doc.insertedId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // POST /api/process -> run full pipeline
  async runPipeline(req, res) {
    try {
      const samples = await telemetryService.getRecentSamples(30);
      const result = await healingService.remediate(samples);
      
      const db = await getDb();
      await db.collection('predictions').insertOne({
        ...result.prediction,
        timestamp: new Date().toISOString()
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /api/status -> return pipeline state
  async getStatus(req, res) {
    try {
      const db = await getDb();
      const state = await db.collection('system_state').find().sort({ timestamp: -1 }).limit(1).toArray();
      res.json(state[0] || { status: 'DEGRADED', lastAction: 'None' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /api/logs -> return logs
  async getLogs(req, res) {
    try {
      const db = await getDb();
      const logs = await db.collection('logs').find().sort({ timestamp: -1 }).limit(50).toArray();
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new PipelineController();
