// Consistent error model:  { "error": { "code", "message", "details"?: [{ field, message }] } }
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
const unprocessable = (code, message, details) => new ApiError(422, code, message, details);

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errors raised by express.json() before our code runs.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: `Request body exceeds the ${err.limit} byte limit` } });
  }
  if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    return res.status(415).json({ error: { code: 'UNSUPPORTED_ENCODING', message: err.message } });
  }
  if (err instanceof ApiError) {
    const body = { code: err.code, message: err.message };
    if (err.details && err.details.length) body.details = err.details;
    return res.status(err.status).json({ error: body });
  }
  // Anything else is a bug: log it, never leak internals to the client.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

module.exports = { ApiError, badRequest, unprocessable, notFoundHandler, errorHandler };
