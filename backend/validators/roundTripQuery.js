const { badRequest } = require('../middleware/errors');

const ALLOWED = ['windowHours', 'tolerancePct'];

function validateRoundTripQuery(query) {
  const errors = [];
  for (const key of Object.keys(query)) {
    if (!ALLOWED.includes(key)) errors.push({ field: key, message: `Unknown query parameter. Allowed: ${ALLOWED.join(', ')}` });
  }
  const opts = { windowHours: 24, tolerancePct: 10 };
  if (query.windowHours !== undefined) {
    const n = /^\d+$/.test(query.windowHours) ? Number(query.windowHours) : NaN;
    if (!(n >= 1 && n <= 168)) errors.push({ field: 'windowHours', message: 'Must be an integer between 1 and 168' });
    else opts.windowHours = n;
  }
  if (query.tolerancePct !== undefined) {
    const n = /^\d+(\.\d+)?$/.test(query.tolerancePct) ? Number(query.tolerancePct) : NaN;
    if (!(n >= 0 && n <= 50)) errors.push({ field: 'tolerancePct', message: 'Must be a number between 0 and 50' });
    else opts.tolerancePct = n;
  }
  if (errors.length) throw badRequest('Invalid query parameters', errors);
  return opts;
}

module.exports = { validateRoundTripQuery };
