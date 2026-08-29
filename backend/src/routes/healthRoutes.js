

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');

router.get('/live', (req, res) => {
  res.json({ status: 'alive', uptime: process.uptime().toFixed(1) });
});

router.get('/ready', async (req, res) => {
  try {
    await getDb(); // will throw if not reachable
    res.json({ status: 'ready', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'not_ready', db: 'disconnected' });
  }
});

router.get('/info', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    service: 'self-heal-backend',
    version: '1.0.0',
    node: process.version,
    pid: process.pid,
    uptime: process.uptime().toFixed(1),
    env: process.env.NODE_ENV || 'development',
    memory: {
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (mem.rss / 1024 / 1024).toFixed(2)
    }
  });
});

module.exports = router;
