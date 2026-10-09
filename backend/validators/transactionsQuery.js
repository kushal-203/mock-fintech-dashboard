const { badRequest } = require('../middleware/errors');

const ACCOUNT_RE = /^ACC-\d{4}$/;
const ALLOWED = ['page', 'pageSize', 'sortBy', 'order', 'account', 'status', 'search'];
const STATUSES = ['completed', 'pending', 'failed'];
const SORT_FIELDS = ['date', 'amount'];

function parseIntStrict(value) {
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

/** Validates GET /api/transactions query parameters and returns normalised options. */
function validateTransactionsQuery(query) {
  const errors = [];
  for (const key of Object.keys(query)) {
    if (!ALLOWED.includes(key)) errors.push({ field: key, message: `Unknown query parameter. Allowed: ${ALLOWED.join(', ')}` });
    else if (Array.isArray(query[key]) || typeof query[key] !== 'string') errors.push({ field: key, message: 'Must be given once, as a single value' });
  }
  if (errors.length) throw badRequest('Invalid query parameters', errors);

  const opts = { page: 1, pageSize: 10, sortBy: 'date', order: 'desc', account: null, status: null, search: null };

  if (query.page !== undefined) {
    const n = parseIntStrict(query.page);
    if (!(n >= 1 && n <= 100000)) errors.push({ field: 'page', message: 'Must be an integer >= 1' });
    else opts.page = n;
  }
  if (query.pageSize !== undefined) {
    const n = parseIntStrict(query.pageSize);
    if (!(n >= 1 && n <= 100)) errors.push({ field: 'pageSize', message: 'Must be an integer between 1 and 100' });
    else opts.pageSize = n;
  }
  if (query.sortBy !== undefined) {
    if (!SORT_FIELDS.includes(query.sortBy)) errors.push({ field: 'sortBy', message: `Must be one of: ${SORT_FIELDS.join(', ')}` });
    else opts.sortBy = query.sortBy;
  }
  if (query.order !== undefined) {
    const o = query.order.toLowerCase();
    if (!['asc', 'desc'].includes(o)) errors.push({ field: 'order', message: 'Must be "asc" or "desc"' });
    else opts.order = o;
  }
  if (query.account !== undefined) {
    if (!ACCOUNT_RE.test(query.account)) errors.push({ field: 'account', message: 'Must look like ACC-1234' });
    else opts.account = query.account;
  }
  if (query.status !== undefined) {
    if (!STATUSES.includes(query.status)) errors.push({ field: 'status', message: `Must be one of: ${STATUSES.join(', ')}` });
    else opts.status = query.status;
  }
  if (query.search !== undefined) {
    const s = query.search.trim();
    if (s.length > 100) errors.push({ field: 'search', message: 'Must be at most 100 characters' });
    else if (s.length) opts.search = s;
  }

  if (errors.length) throw badRequest('Invalid query parameters', errors);
  return opts;
}

module.exports = { validateTransactionsQuery, ACCOUNT_RE, STATUSES };
