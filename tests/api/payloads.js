// Test data for POST /api/transfers. Keeps the feature files readable and the data in one place.
const VALID = { fromAccount: 'ACC-1001', toAccount: 'ACC-1002', amount: 125.5, description: 'API test transfer' };

const without = (...fields) => {
  const copy = { ...VALID };
  fields.forEach((f) => delete copy[f]);
  return copy;
};

const MISSING_FIELD_CASES = {
  'missing fromAccount': without('fromAccount'),
  'missing toAccount': without('toAccount'),
  'missing amount': without('amount'),
  'missing all required fields': { description: 'only a description' },
  'empty object': {},
  'empty-string fromAccount': { ...VALID, fromAccount: '' },
  'null amount': { ...VALID, amount: null },
};

// Printable but unusual text that a payments API must store and return byte-for-byte.
const SAFE_SPECIAL_DESCRIPTIONS = {
  'emoji': 'Rent 🏠 + bills 💡 ✅',
  'multi-language unicode': 'Paiement – 支付 – الدفع – Платёж',
  'SQL injection attempt': "x'); DROP TABLE transactions;--",
  'HTML/script injection attempt': '<script>alert("xss")</script><img src=x onerror=alert(1)>',
  'quotes and backslashes': 'He said "hi" \\ it\'s fine',
  'zero-width and RTL marks': 'pay​ment ‮dcba',
  'percent and underscore wildcards': '100% _done_ %%',
};

// Characters a description must NOT contain.
const UNSAFE_DESCRIPTIONS = {
  'null byte': 'before\u0000after',
  'newline': 'line one\nline two',
  'tab': 'col1\tcol2',
  'bell control character': 'ding\u0007',
};

const INVALID_ACCOUNT_IDS = {
  'SQL injection in account ID': "ACC-1001' OR '1'='1",
  'lower-case prefix': 'acc-1001',
  'too many digits': 'ACC-10011',
  'full-width digits': 'ACC-１００１',
  'very long string': `ACC-${'1'.repeat(5000)}`,
  'number instead of string': 1001,
};

module.exports = { VALID, without, MISSING_FIELD_CASES, SAFE_SPECIAL_DESCRIPTIONS, UNSAFE_DESCRIPTIONS, INVALID_ACCOUNT_IDS };
