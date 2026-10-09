#!/usr/bin/env node
// CLI for the self-healing POC:  npm run heal   (uses Claude when ANTHROPIC_API_KEY is set)
// Starts the app, then for every brittle locator: detect → snapshot → propose → validate → report.
// Output: results/self-healing/{healing-report.md, healing-report.json, suggested-fixes.patch, prompts/}
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('../config/config');
const { BROKEN_LOCATORS } = require('./BrittleDashboardPage');
const healer = require('./healer');

const OUT = path.resolve(__dirname, '..', '..', 'results', 'self-healing');
const MIN_CONFIDENCE = 0.6;

async function openDashboard(browser) {
  const page = await browser.newPage({ baseURL: config.baseUrl, viewport: { width: 1366, height: 900 } });
  await page.goto('/');
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return page;
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'prompts'), { recursive: true });
  let server;
  if (config.startServer) {
    process.env.ENABLE_TEST_ROUTES = 'true';
    server = await require('../../backend/server').start(config.serverPort);
  }
  const browser = await chromium.launch({ headless: true, executablePath: config.executablePath });
  const results = [];
  let engine = 'heuristic';
  try {
    for (const [name, def] of Object.entries(BROKEN_LOCATORS)) {
      let page = await openDashboard(browser);
      const entry = { name, brokenSelector: def.selector, antiPattern: def.antiPattern, detection: await healer.detect(page, def.selector) };
      if (entry.detection.broken) {
        try {
          const ctx = await healer.snapshot(page);
          const out = await healer.propose(def, ctx);
          engine = out.engine;
          entry.proposal = out.proposal;
          fs.writeFileSync(path.join(OUT, 'prompts', `${name}.txt`), out.prompt);
        } catch (e) {
          entry.error = e.message;
        }
        if (entry.proposal?.locator) {
          await page.close();
          page = await openDashboard(browser); // clean state for behavioural validation
          entry.validation = await healer.validate(page, def, entry.proposal);
          entry.suggestedCode = healer.toCode(entry.proposal.locator);
          const allPass = entry.validation.every((c) => c.pass);
          entry.accepted = allPass && entry.proposal.confidence >= MIN_CONFIDENCE;
          entry.status = entry.accepted ? 'HEALED (pending human review)' : allPass ? 'NEEDS REVIEW (low confidence)' : 'REJECTED (validation failed)';
        } else {
          entry.status = 'NO PROPOSAL';
        }
      } else {
        entry.status = 'OK (not broken)';
      }
      results.push(entry);
      await page.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  writeReports(results, engine);
  console.log(`\nSelf-healing (${engine}): ${results.filter((r) => r.accepted).length}/${results.length} broken locators healed & validated.`);
  for (const r of results) {
    console.log(` - ${r.name.padEnd(20)} ${r.status}`);
    if (r.suggestedCode) console.log(`     ${r.brokenSelector}\n  -> ${r.suggestedCode}`);
  }
}

function writeReports(results, engine) {
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'healing-report.json'), JSON.stringify({ engine, generatedAt: now, minConfidence: MIN_CONFIDENCE, results }, null, 2));
  const md = [
    '# Self-healing report', '',
    `Engine: **${engine}** · Generated: ${now} · Confidence threshold: ${MIN_CONFIDENCE}`, '',
    '| Locator | Broken selector | Detected | Suggested replacement | Confidence | Validation | Status |',
    '|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.name} | \`${r.brokenSelector}\` | ${r.detection.reason || 'ok'} | ${r.suggestedCode ? `\`${r.suggestedCode}\`` : '-'} | ${r.proposal?.confidence ?? '-'} | ${(r.validation || []).map((c) => `${c.pass ? '✅' : '❌'} ${c.check}`).join('<br>') || '-'} | ${r.status} |`),
    '', 'Nothing was changed in the source code. Review suggested-fixes.patch and apply it through a pull request.', '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'healing-report.md'), md);
  const patch = results.filter((r) => r.accepted).map((r) => [
    `--- a/tests/self-healing/BrittleDashboardPage.js  (${r.name})`,
    '+++ b/tests/page-objects/... (suggested)',
    `- page.locator(${JSON.stringify(r.brokenSelector)})`,
    `+ ${r.suggestedCode}`,
  ].join('\n')).join('\n\n');
  fs.writeFileSync(path.join(OUT, 'suggested-fixes.patch'), `${patch}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
