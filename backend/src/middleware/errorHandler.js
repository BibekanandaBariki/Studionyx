/**
 * Central error-handling middleware.
 * Ensures we never leak internal details to the client.
 */
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('API error:', err);

  const status = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  const payload = {
    success: false,
    message: err.publicMessage || err.message || 'Internal server error',
  };

  if (!isProd) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}



