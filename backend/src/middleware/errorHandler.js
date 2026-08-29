function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message, err.stack);

  const status = err.statusCode || 500;
  const payload = {
    error: err.message || 'Internal Server Error',
    requestId: req.requestId
  };

  // Expose stack only in development
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { errorHandler };
