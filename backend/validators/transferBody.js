const { ApiError, unprocessable } = require('../middleware/errors');
const { ACCOUNT_RE } = require('./transactionsQuery');

const REQUIRED = ['fromAccount', 'toAccount', 'amount'];
const OPTIONAL = ['description'];
const MAX_AMOUNT = 1_000_000;
const MAX_DESCRIPTION = 140;
// C0/C1 control characters (incl. NUL); printable Unicode such as emoji or RTL text is allowed.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Validates a POST /api/transfers body.
 *  400 – the request is structurally wrong (not an object, required fields missing)
 *  422 – the request is well-formed but its values break business rules
 */
function validateTransferBody(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_BODY', 'Request body must be a JSON object');
  }

  const missing = REQUIRED.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) {
    throw new ApiError(400, 'MISSING_FIELDS', `Missing required field(s): ${missing.join(', ')}`,
      missing.map((field) => ({ field, message: 'This field is required' })));
  }

  const errors = [];
  const unknown = Object.keys(body).filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k));
  unknown.forEach((field) => errors.push({ field, message: 'Unknown field' }));

  for (const field of ['fromAccount', 'toAccount']) {
    if (typeof body[field] !== 'string') errors.push({ field, message: 'Must be a string' });
    else if (!ACCOUNT_RE.test(body[field])) errors.push({ field, message: 'Must look like ACC-1234' });
  }

  const { amount } = body;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    errors.push({ field: 'amount', message: 'Must be a number (not a string)' });
  } else if (amount <= 0) {
    errors.push({ field: 'amount', message: 'Must be greater than 0' });
  } else if (amount > MAX_AMOUNT) {
    errors.push({ field: 'amount', message: `Must not exceed ${MAX_AMOUNT.toLocaleString('en-US')}` });
  } else if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    errors.push({ field: 'amount', message: 'Must have at most 2 decimal places' });
  }

  if (body.description !== undefined) {
    const d = body.description;
    if (typeof d !== 'string') errors.push({ field: 'description', message: 'Must be a string' });
    else if ([...d].length > MAX_DESCRIPTION) errors.push({ field: 'description', message: `Must be at most ${MAX_DESCRIPTION} characters` });
    else if (CONTROL_CHARS.test(d)) errors.push({ field: 'description', message: 'Must not contain control characters' });
  }

  if (!errors.length && body.fromAccount === body.toAccount) {
    errors.push({ field: 'toAccount', message: 'Must be different from fromAccount' });
  }

  if (errors.length) throw unprocessable('INVALID_FIELDS', 'One or more fields are invalid', errors);

  return {
    fromAccount: body.fromAccount,
    toAccount: body.toAccount,
    amountCents: Math.round(amount * 100),
    description: body.description || '',
  };
}

module.exports = { validateTransferBody, MAX_AMOUNT, MAX_DESCRIPTION };
