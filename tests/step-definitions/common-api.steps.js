// Assertions shared by every API feature. They read the last response from this.ctx.res.
const { Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('the response status should be {int}', async function (status) {
  const { res } = this.ctx;
  expect(res.status, `HTTP ${res.status} – body: ${res.text.slice(0, 300)}`).toBe(status);
  expect(res.headers['content-type'] || '').toContain('application/json');
});

Then('the response should not be a server error', async function () {
  expect(this.ctx.res.status, 'server-side failure (5xx)').toBeLessThan(500);
});

Then('the error code should be {string}', async function (code) {
  expect(this.ctx.res.json?.error, `error body: ${this.ctx.res.text.slice(0, 300)}`).toBeTruthy();
  expect(this.ctx.res.json.error.code).toBe(code);
  expect(typeof this.ctx.res.json.error.message).toBe('string');
  expect(this.ctx.res.json.error.message.length).toBeGreaterThan(0);
});

Then('the error details should mention field {string}', async function (field) {
  const details = this.ctx.res.json?.error?.details || [];
  expect(details.map((d) => d.field), `details: ${JSON.stringify(details)}`).toContain(field);
});

Then('the error details should name the fields {string}', async function (list) {
  const expected = list.split(',').map((s) => s.trim()).sort();
  const actual = (this.ctx.res.json?.error?.details || []).map((d) => d.field).sort();
  expect(actual).toEqual(expected);
});
