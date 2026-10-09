// Steps bound to the intentionally broken page object (self-healing exercise).
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { BrittleDashboardPage } = require('../self-healing/BrittleDashboardPage');

const QUICK = { timeout: 3000 }; // fail fast – these locators are known to be broken

Given('I open the dashboard with the brittle page object', async function () {
  await this.dashboard.open('/');
  this.brittle = new BrittleDashboardPage(this.page);
});

When('I choose status {string} with the brittle status filter', async function (status) {
  await this.brittle.statusFilter.selectOption(status, QUICK);
});

When('I click the brittle Apply button', async function () {
  await this.brittle.applyFiltersButton.click(QUICK);
});

Then('the brittle result summary should mention {string}', async function (text) {
  await expect(this.brittle.resultSummary).toContainText(text, QUICK);
});

Then('the brittle trend chart should be visible', async function () {
  await expect(this.brittle.trendChart).toBeVisible(QUICK);
});

Then('the brittle Send transfer button should be enabled', async function () {
  await expect(this.brittle.sendTransferButton).toBeEnabled(QUICK);
});
