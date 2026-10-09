const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const oracle = require('../utils/oracle');

// ---------- helpers ----------
async function allTransactions(world) {
  return world.transactionsApi.all();
}

// ---------- navigation ----------
Given('I open the transaction dashboard', async function () {
  await this.dashboard.open('/');
  this.ctx.initialTxnCount = await this.dashboard.kpis.value('Transactions');
});

Then('the {string} heading should be visible', async function (name) {
  await expect(this.dashboard.heading(name)).toBeVisible();
});

// ---------- KPIs ----------
Then('the summary cards should show:', async function (table) {
  for (const [name] of table.raw()) {
    const card = this.dashboard.kpis.card(name);
    await expect(card).toBeVisible();
    await expect(card.locator('.kpi-value')).not.toHaveText('–');
  }
});

Then('the summary figures should match my own calculation from the transaction data', async function () {
  const txns = await allTransactions(this);
  const expected = oracle.summarise(txns);
  const expectedFlags = oracle.findRoundTrips(txns).length;
  this.attach(JSON.stringify({ ...expected, expectedFlags }, null, 2), 'application/json');
  expect(await this.dashboard.kpis.value('Total volume')).toBeCloseTo(expected.totalVolume, 2);
  expect(await this.dashboard.kpis.value('Transactions')).toBe(expected.transactionCount);
  expect(await this.dashboard.kpis.value('Recent flags')).toBe(expectedFlags);
  expect(await this.dashboard.kpis.value('Active accounts')).toBeGreaterThan(0);
});

Then('the {string} card should show the number of flagged round trips', async function (name) {
  const expected = oracle.findRoundTrips(await allTransactions(this)).length;
  expect(await this.dashboard.kpis.value(name)).toBe(expected);
});

Then('the {string} card should have increased by {int}', async function (name, by) {
  await expect.poll(() => this.dashboard.kpis.value(name)).toBe(this.ctx.initialTxnCount + by);
});

Then('the {string} card should not have changed', async function (name) {
  expect(await this.dashboard.kpis.value(name)).toBe(this.ctx.initialTxnCount);
});

// ---------- chart ----------
Then('the daily volume chart should be visible', async function () {
  await expect(this.dashboard.chart.canvas).toBeVisible();
  this.ctx.chart = await this.dashboard.chart.renderedData();
  expect(this.ctx.chart, 'Chart.js instance attached to the canvas').not.toBeNull();
  expect(this.ctx.chart.width).toBeGreaterThan(0);
  expect(this.ctx.chart.height).toBeGreaterThan(0);
  this.attach(JSON.stringify(this.ctx.chart, null, 2), 'application/json');
});

Then('the chart should plot one point per day that has completed transfers', async function () {
  const days = oracle.dailyVolume(await allTransactions(this));
  expect(this.ctx.chart.labels).toHaveLength(days.length);
  expect(this.ctx.chart.labels).toEqual(days.map((d) => d.date.slice(5)));
});

Then('every chart value should be a valid number, not negative, with at least one value above zero', async function () {
  for (const ds of this.ctx.chart.datasets) {
    for (const v of ds.data) {
      expect(Number.isFinite(v), `${ds.label} value ${v}`).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(Math.max(...ds.data), `${ds.label} has at least one non-zero value`).toBeGreaterThan(0);
  }
});

Then('the chart values should match my own daily totals', async function () {
  const days = oracle.dailyVolume(await allTransactions(this));
  const volume = this.dashboard.chart.dataset(this.ctx.chart, 'Volume (USD)').data;
  const count = this.dashboard.chart.dataset(this.ctx.chart, 'Transfers').data;
  days.forEach((d, i) => {
    expect(volume[i], `volume on ${d.date}`).toBeCloseTo(d.volume, 2);
    expect(count[i], `count on ${d.date}`).toBe(d.count);
  });
});

Then('the chart volumes should add up to the {string} card', async function (name) {
  const volume = this.dashboard.chart.dataset(this.ctx.chart, 'Volume (USD)').data;
  const sum = volume.reduce((s, v) => s + oracle.cents(v), 0) / 100;
  expect(sum).toBeCloseTo(await this.dashboard.kpis.value(name), 2);
});

// ---------- filters, search, sort ----------
When('I filter the transactions by status {string}', async function (status) {
  await this.dashboard.applyFilters({ status });
});

When('I filter the transactions by account {string}', async function (account) {
  await this.dashboard.applyFilters({ account });
});

When('I apply these filters:', async function (table) {
  await this.dashboard.applyFilters(table.rowsHash());
});

When('I search the transactions for {string}', async function (text) {
  await this.dashboard.applyFilters({ search: text });
});

Then('every visible row should have status {string}', async function (status) {
  const rows = await this.dashboard.transactions.data();
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) expect(r.statusValue, `row ${r.id}`).toBe(status.toLowerCase());
});

Then('every visible row should involve account {string}', async function (account) {
  const rows = await this.dashboard.transactions.data();
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) expect([r.from, r.to], `row ${r.id}`).toContain(account);
});

Then('the result count should equal the number of {string} transactions in the data', async function (status) {
  const expected = (await allTransactions(this)).filter((t) => t.status === status.toLowerCase()).length;
  expect(await this.dashboard.transactions.totalFromCount()).toBe(expected);
});

Then('the result count should equal the number of transactions involving {string} in the data', async function (account) {
  const expected = (await allTransactions(this)).filter((t) => t.fromAccount === account || t.toAccount === account).length;
  expect(await this.dashboard.transactions.totalFromCount()).toBe(expected);
});

Then('the visible rows should be sorted by amount from high to low', async function () {
  const amounts = (await this.dashboard.transactions.data()).map((r) => r.amountValue);
  expect(amounts.length).toBeGreaterThan(1);
  expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
});

Then('the table should show exactly {int} row(s)', async function (n) {
  await expect(this.dashboard.transactions.rows).toHaveCount(n);
});

Then('that row should have the ID {string}', async function (id) {
  const [row] = await this.dashboard.transactions.data();
  expect(row.id).toBe(id);
});

Then('that row should be marked as {string}', async function (label) {
  const [row] = await this.dashboard.transactions.data();
  expect(row.flagged, `row ${row.id} badge`).toBe(true);
  await expect(this.dashboard.transactions.rows.first().getByText(label, { exact: true })).toBeVisible();
});

Then('the table should show the message {string}', async function (message) {
  await expect(this.dashboard.transactions.table.getByText(message)).toBeVisible();
  await expect(this.dashboard.transactions.rows).toHaveCount(0);
});

Then('the result count should read {string}', async function (text) {
  await expect(this.dashboard.transactions.resultCount).toHaveText(text);
});

// ---------- pagination ----------
When('I go to the next page of transactions', async function () {
  await this.dashboard.transactions.reloadVia(() => this.dashboard.transactions.nextButton.click());
});

Then('the page indicator should read {string}', async function (text) {
  await expect(this.dashboard.transactions.pageIndicator).toHaveText(text);
});

Then('the {string} button should be enabled', async function (name) {
  await expect(this.page.getByRole('button', { name, exact: true })).toBeEnabled();
});

// ---------- flags ----------
Then('the flagged round-trip table should list exactly the round trips I detect independently in the data', async function () {
  const expected = oracle.findRoundTrips(await allTransactions(this));
  const shown = await this.dashboard.flags.pairs();
  this.attach(`Expected (independent):\n${JSON.stringify(expected, null, 2)}`);
  expect(expected.length, 'seed data should contain round trips').toBeGreaterThan(0);
  expect([...shown].sort((a, b) => a.outboundTxn.localeCompare(b.outboundTxn) || a.returnTxn.localeCompare(b.returnTxn))).toEqual(expected);
});

// ---------- transfer form ----------
When('I send a transfer of {float} from {string} to {string} with description {string}', async function (amount, from, to, description) {
  this.ctx.transfer = { amount, from, to, description };
  await this.dashboard.transferForm.fill({ from, to, amount, description });
  const response = await this.dashboard.transferForm.submit();
  this.ctx.transferResponse = { status: response.status(), body: await response.json() };
});

Then('I should see a success message for the new transfer', async function () {
  expect(this.ctx.transferResponse.status).toBe(201);
  const id = this.ctx.transferResponse.body.data.id;
  await expect(this.dashboard.transferForm.feedback).toContainText(`Transfer ${id} completed`);
});

Then('the newest transaction in the table should be that transfer', async function () {
  const { id } = this.ctx.transferResponse.body.data;
  await expect(this.dashboard.transactions.rows.first()).toContainText(id);
  const [row] = await this.dashboard.transactions.data();
  expect(row).toMatchObject({ id, from: this.ctx.transfer.from, to: this.ctx.transfer.to, description: this.ctx.transfer.description });
  expect(row.amountValue).toBeCloseTo(this.ctx.transfer.amount, 2);
});

Then('I should see the error {string}', async function (message) {
  await expect(this.dashboard.transferForm.feedback).toContainText(message);
});
