const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const P = require('../api/payloads');

function lookup(map, key, kind) {
  if (!(key in map)) throw new Error(`Unknown ${kind} "${key}". Known: ${Object.keys(map).join(', ')}`);
  return map[key];
}

async function send(world, payload) {
  world.ctx.sent = payload;
  if (world.ctx.countBefore === undefined) world.ctx.countBefore = (await world.transactionsApi.list({ pageSize: 1 })).json.pagination.totalItems;
  world.ctx.res = await world.transfersApi.create(payload);
  logExchange(world, JSON.stringify(payload));
}

async function sendRaw(world, body, contentType) {
  world.ctx.res = await world.transfersApi.createRaw(body, contentType);
  logExchange(world, body);
}

function logExchange(world, body) {
  const clip = (s) => (s.length > 300 ? `${s.slice(0, 300)}… (${s.length} chars)` : s);
  world.attach(`POST /api/transfers\nRequest: ${clip(body)}\n→ ${world.ctx.res.status} in ${world.ctx.res.elapsedMs} ms\nResponse: ${clip(world.ctx.res.text)}`);
}

// ---------- requests ----------
When('I send a valid transfer request', async function () {
  await send(this, { ...P.VALID });
});

When('I send a transfer with {string}', async function (name) {
  await send(this, lookup(P.MISSING_FIELD_CASES, name, 'missing-field case'));
});

When('I send the raw body {string} with content type {string}', async function (body, contentType) {
  await sendRaw(this, body, contentType);
});

When('I send a valid transfer with a description of {int} characters', async function (length) {
  await send(this, { ...P.VALID, description: 'D'.repeat(length) });
});

When('I send a valid transfer with a description of {int} emoji', async function (count) {
  await send(this, { ...P.VALID, description: '💸'.repeat(count) }); // each emoji = 2 UTF-16 units, 4 UTF-8 bytes
});

When('I send a valid transfer with the {string} description', async function (name) {
  await send(this, { ...P.VALID, description: lookup(P.SAFE_SPECIAL_DESCRIPTIONS, name, 'description case') });
});

When('I send a valid transfer with the unsafe {string} description', async function (name) {
  await send(this, { ...P.VALID, description: lookup(P.UNSAFE_DESCRIPTIONS, name, 'unsafe description case') });
});

When('I send a transfer from account {string}', async function (name) {
  await send(this, { ...P.VALID, fromAccount: lookup(P.INVALID_ACCOUNT_IDS, name, 'account case') });
});

When('I send a transfer of raw amount {word} from {string} to {string}', async function (rawAmount, from, to) {
  // Built as raw JSON so values like 1e309 (→ Infinity) or "100" (string) reach the API unchanged.
  const body = `{"fromAccount":"${from}","toAccount":"${to}","amount":${rawAmount},"description":"Amount boundary"}`;
  await sendRaw(this, body, 'application/json');
});

When('I send a transfer of {float} from {string} to {string}', async function (amount, from, to) {
  await send(this, { fromAccount: from, toAccount: to, amount });
});

When('I send a valid transfer with an extra field {string} set to true', async function (field) {
  await send(this, { ...P.VALID, [field]: true });
});

// ---------- assertions ----------
Then('the response should contain the created transaction', async function () {
  const t = this.ctx.res.json.data;
  expect(t).toMatchObject({
    fromAccount: this.ctx.sent.fromAccount,
    toAccount: this.ctx.sent.toAccount,
    amount: this.ctx.sent.amount,
    description: this.ctx.sent.description,
    currency: 'USD',
    status: 'completed',
  });
  expect(t.id).toMatch(/^TXN-\d{6}$/);
  expect(Number.isNaN(Date.parse(t.createdAt))).toBe(false);
  expect(this.ctx.res.headers.location).toContain(t.id);
});

Then('the transfer should appear in GET \\/api\\/transactions', async function () {
  const { id } = this.ctx.res.json.data;
  const res = await this.transactionsApi.list({ search: id });
  expect(res.json.data).toHaveLength(1);
  expect(res.json.data[0]).toEqual(this.ctx.res.json.data);
});

Then('the stored description should be exactly what I sent', async function () {
  const { id, description } = this.ctx.res.json.data;
  expect(description).toBe(this.ctx.sent.description);
  const stored = (await this.transactionsApi.list({ search: id })).json.data[0];
  expect(stored.description).toBe(this.ctx.sent.description);
});

Then('the transactions table should still be intact', async function () {
  const res = await this.transactionsApi.list({ pageSize: 1 });
  expect(res.status).toBe(200);
  expect(res.json.pagination.totalItems).toBe(this.ctx.countBefore + 1);
});

Then('no new transaction should have been recorded', async function () {
  const res = await this.transactionsApi.list({ pageSize: 1 });
  expect(res.json.pagination.totalItems).toBe(this.ctx.countBefore);
});
