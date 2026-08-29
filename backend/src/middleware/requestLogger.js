/**
 * ============================================================
 * REQUEST LOGGER MIDDLEWARE
 * middleware/requestLogger.js
 * ============================================================
 * Emits a structured JSON log line for every inbound request.
 * Fields: timestamp, requestId, method, path, status, latencyMs.
 * The `res.on('finish')` hook lets us capture the final status
 * code after the response has been sent.
 * ============================================================
 */

'use strict';

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const latencyMs = Date.now() - start;
    console.log(JSON.stringify({
      type:       'REQUEST',
      timestamp:  new Date().toISOString(),
      requestId:  req.requestId,
      method:     req.method,
      path:       req.path,
      status:     res.statusCode,
      latencyMs
    }));
  });

  next();
}

module.exports = { requestLogger };
