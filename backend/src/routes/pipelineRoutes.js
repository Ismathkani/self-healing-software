const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipelineController');

// POST /telemetry → receive data
router.post('/telemetry', (req, res) => pipelineController.receiveTelemetry(req, res));

// POST /process → run full pipeline
router.post('/process', (req, res) => pipelineController.runPipeline(req, res));

// GET /status → return pipeline state
router.get('/status', (req, res) => pipelineController.getStatus(req, res));

// GET /logs → return logs
router.get('/logs', (req, res) => pipelineController.getLogs(req, res));

module.exports = router;
