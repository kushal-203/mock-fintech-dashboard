#!/usr/bin/env node
// Negative test for the healer's validation step:  npm run heal:verify
// Feeds deliberately WRONG proposals into validate() and checks every one is rejected, so a
// confident-but-wrong AI suggestion cannot slip through. Exit code 1 if any wrong proposal passes.
const { chromium } = require('playwright');
const config = require('../config/config');
const healer = require('./healer');
const { BROKEN_LOCATORS } = require('./BrittleDashboardPage');

const WRONG_PROPOSALS = [
  ['applyFiltersButton', { strategy: 'role', role: 'button', name: 'Reset' }, 'right role, wrong button (also reloads the table)'],
  ['resultSummary', { strategy: 'testid', value: 'page-indicator' }, 'nearby text element with a different meaning'],
  ['trendChart', { strategy: 'testid', value: 'flags-table' }, 'unique and visible, but not a chart'],
  ['statusFilter', { strategy: 'role', role: 'combobox', name: 'Account' }, 'right role, wrong dropdown'],
  ['sendTransferButton', { strategy: 'css', value: 'button' }, 'disallowed CSS strategy'],
];

(async () => {
  let server;
  if (config.startServer) {
    process.env.ENABLE_TEST_ROUTES = 'true';
    server = await require('../../backend/server').start(config.serverPort);
  }
  const browser = await chromium.launch({ executablePath: config.executablePath });
  let leaks = 0;
  for (const [name, locator, why] of WRONG_PROPOSALS) {
    const page = await browser.newPage({ baseURL: config.baseUrl });
    await page.goto('/');
    await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    const checks = await healer.validate(page, BROKEN_LOCATORS[name], { locator, confidence: 0.95 });
    const accepted = checks.every((c) => c.pass);
    if (accepted) leaks += 1;
    console.log(`${accepted ? '✖ ACCEPTED' : '✔ rejected'}  ${name.padEnd(20)} ${JSON.stringify(locator)}  (${why})`);
    if (!accepted) console.log(`             failed check: ${checks.filter((c) => !c.pass).map((c) => c.check).join('; ')}`);
    await page.close();
  }
  await browser.close();
  if (server) server.close();
  console.log(leaks ? `\n${leaks} wrong proposal(s) passed validation!` : `\nAll ${WRONG_PROPOSALS.length} wrong proposals were rejected by validation.`);
  process.exit(leaks ? 1 : 0);
})();
