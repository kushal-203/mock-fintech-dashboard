const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const oracle = require('../utils/oracle');

When('I request the transactions with no parameters', async function () {
  this.ctx.res = await this.transactionsApi.listRaw('');
});

When('I request the transactions with {string}', async function (query) {
  this.ctx.query = new URLSearchParams(query);
  this.ctx.res = await this.transactionsApi.listRaw(query);
  this.attach(`GET /api/transactions?${query} → ${this.ctx.res.status}\n${this.ctx.res.text.slice(0, 400)}`);
});

When('I request the round-trip analytics', async function () {
  this.ctx.res = await this.transactionsApi.roundTripsRaw('');
});

When('I request the round-trip analytics with {string}', async function (query) {
  this.ctx.res = await this.transactionsApi.roundTripsRaw(query);
  this.attach(`GET /api/analytics/round-trips?${query} → ${this.ctx.res.status}\n${this.ctx.res.text.slice(0, 400)}`);
});

Then('the response should contain {int} transactions on page {int}', async function (n, page) {
  expect(this.ctx.res.json.data).toHaveLength(n);
  expect(this.ctx.res.json.pagination.page).toBe(page);
  expect(this.ctx.res.json.pagination.totalPages).toBe(Math.ceil(this.ctx.res.json.pagination.totalItems / n));
});

Then('the transactions should be sorted by {string} in {string} order', async function (field, order) {
  const values = this.ctx.res.json.data.map((t) => (field === 'date' ? Date.parse(t.createdAt) : t.amount));
  const sorted = [...values].sort((a, b) => (order === 'asc' ? a - b : b - a));
  expect(values).toEqual(sorted);
});

Then('every transaction should involve {string} and have status {string}', async function (account, status) {
  const { data } = this.ctx.res.json;
  expect(data.length).toBeGreaterThan(0);
  for (const t of data) {
    expect([t.fromAccount, t.toAccount]).toContain(account);
    expect(t.status).toBe(status);
  }
});

Then('the total should equal my own count from the full data set', async function () {
  const account = this.ctx.query.get('account');
  const status = this.ctx.query.get('status');
  const all = await this.transactionsApi.all();
  const expected = all.filter((t) => (t.fromAccount === account || t.toAccount === account) && t.status === status).length;
  expect(this.ctx.res.json.pagination.totalItems).toBe(expected);
});

function compareRoundTrips(world, criteria) {
  return async () => {
    const expected = oracle.findRoundTrips(await world.transactionsApi.all(), criteria);
    const actual = world.ctx.res.json.data.map(({ outboundTxn, returnTxn }) => ({ outboundTxn, returnTxn }))
      .sort((a, b) => a.outboundTxn.localeCompare(b.outboundTxn) || a.returnTxn.localeCompare(b.returnTxn));
    world.attach(`Independent detection (${JSON.stringify(criteria)}): ${expected.length} pair(s)\n${JSON.stringify(expected)}`);
    expect(actual).toEqual(expected);
    expect(world.ctx.res.json.count).toBe(expected.length);
  };
}

Then('the round trips should equal the ones I detect independently', async function () {
  await compareRoundTrips(this, { windowHours: 24, tolerancePct: 10 })();
});

Then('the round trips should equal the ones I detect independently with {string}', async function (query) {
  const q = new URLSearchParams(query);
  await compareRoundTrips(this, { windowHours: Number(q.get('windowHours')), tolerancePct: Number(q.get('tolerancePct')) })();
});
