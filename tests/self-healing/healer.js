/*
 * Self-healing locator utility
 * ----------------------------
 *   detect()      – does the locator resolve to exactly one visible element?
 *   snapshot()    – capture the page context (ARIA tree + compact candidate list)
 *   propose()     – ask Claude (if ANTHROPIC_API_KEY is set) or a deterministic heuristic for a
 *                   resilient replacement, restricted to role / test-id / label / text strategies
 *   validate()    – accept the proposal only if it is unique, visible, has the expected role and
 *                   passes a behavioural check
 *   toCode()      – render the proposal as Playwright code for a reviewable patch
 * The CLI that drives it is tests/self-healing/run-healing.js. Nothing is ever written to source.
 */
const { buildPrompt } = require('./prompt');

const ALLOWED_STRATEGIES = ['role', 'testid', 'label', 'text'];
const SEMANTIC_ROLES = ['button', 'link', 'combobox', 'searchbox', 'textbox', 'spinbutton', 'img', 'heading', 'table', 'checkbox'];

// ---------- 1. Detect ----------
async function detect(page, selector) {
  try {
    const loc = page.locator(selector);
    const count = await loc.count();
    if (count === 1 && (await loc.isVisible())) return { broken: false, count };
    return { broken: true, count, reason: count === 0 ? 'no element matched' : `${count} elements matched (ambiguous)` };
  } catch (e) {
    return { broken: true, count: 0, reason: `invalid selector: ${e.message.split('\n')[0]}` };
  }
}

// ---------- 2. Context ----------
async function snapshot(page) {
  const candidates = await page.evaluate((semanticRoles) => {
    const roleOf = (el) => {
      if (el.getAttribute('role')) return el.getAttribute('role');
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (tag === 'button') return 'button';
      if (tag === 'a' && el.hasAttribute('href')) return 'link';
      if (tag === 'select') return 'combobox';
      if (tag === 'input') return { search: 'searchbox', number: 'spinbutton', checkbox: 'checkbox' }[type] || 'textbox';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (tag === 'table') return 'table';
      return null;
    };
    const nameOf = (el) => {
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
      if (el.getAttribute('aria-labelledby')) {
        return el.getAttribute('aria-labelledby').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
      }
      if (el.labels && el.labels[0]) return el.labels[0].textContent.trim();
      return (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    };
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nodes = document.querySelectorAll('button, a[href], input, select, textarea, h1, h2, h3, table, canvas, [role], [data-testid]');
    return [...nodes].filter(visible).slice(0, 200).map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: roleOf(el),
      name: nameOf(el),
      testId: el.getAttribute('data-testid'),
      id: el.id || null,
      semantic: semanticRoles.includes(roleOf(el)),
    }));
  }, SEMANTIC_ROLES);
  const aria = await page.locator('body').ariaSnapshot();
  return { candidates, aria };
}

// ---------- 3a. Propose with Claude ----------
async function proposeWithClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.HEAL_MODEL || 'claude-sonnet-4-5',
      max_tokens: 600,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.content.map((c) => c.text || '').join('');
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(json[0]);
}

// ---------- 3b. Propose with a deterministic heuristic (offline / CI fallback) ----------
const STOP = new Set(['the', 'a', 'an', 'that', 'of', 'by', 'to', 'and', 'how', 'many', 'new', 'btn', 'xpath', 'html', 'body', 'div', 'main', 'section', 'form', 'label']);
const tokens = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
const stem = (t) => t.replace(/(ing|es|s)$/, '');

function proposeHeuristically(def, candidates) {
  const want = new Set([...tokens(def.intent), ...tokens(def.selector)].map(stem));
  let best = null;
  for (const c of candidates) {
    const have = new Set([...tokens(c.name), ...tokens(c.testId)].map(stem));
    const overlap = [...have].filter((t) => want.has(t));
    let score = overlap.length / Math.max(2, Math.min(have.size, 6));
    if (def.expectedRole) score += c.role === def.expectedRole ? 0.5 : -0.4;
    else if (c.testId) score += 0.2;
    if (!best || score > best.score) best = { c, score, overlap };
  }
  if (!best || best.score <= 0) return { locator: null, confidence: 0, reason: 'No candidate matches the intent' };
  const { c } = best;
  let locator;
  if (c.semantic && c.name) locator = { strategy: 'role', role: c.role, name: c.name };
  else if (c.testId) locator = { strategy: 'testid', value: c.testId };
  else locator = { strategy: 'text', value: c.name };
  return {
    locator,
    confidence: Number(Math.max(0, Math.min(0.99, best.score)).toFixed(2)),
    reason: `Token overlap with intent: ${best.overlap.join(', ') || 'none'}; role=${c.role || 'n/a'}`,
  };
}

async function propose(def, ctx) {
  const prompt = buildPrompt({ def, ...ctx });
  if (process.env.ANTHROPIC_API_KEY) return { engine: 'claude', prompt, proposal: await proposeWithClaude(prompt) };
  return { engine: 'heuristic', prompt, proposal: proposeHeuristically(def, ctx.candidates) };
}

// ---------- 4. Validate ----------
function toLocator(page, loc) {
  if (!loc || !ALLOWED_STRATEGIES.includes(loc.strategy)) {
    throw new Error(`Strategy "${loc && loc.strategy}" is not allowed (only ${ALLOWED_STRATEGIES.join(', ')})`);
  }
  switch (loc.strategy) {
    case 'role': return page.getByRole(loc.role, { name: loc.name, exact: true });
    case 'testid': return page.getByTestId(loc.value);
    case 'label': return page.getByLabel(loc.value, { exact: true });
    default: return page.getByText(loc.value, { exact: true });
  }
}

function toCode(loc) {
  const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  switch (loc.strategy) {
    case 'role': return `page.getByRole(${q(loc.role)}, { name: ${q(loc.name)}, exact: true })`;
    case 'testid': return `page.getByTestId(${q(loc.value)})`;
    case 'label': return `page.getByLabel(${q(loc.value)}, { exact: true })`;
    default: return `page.getByText(${q(loc.value)}, { exact: true })`;
  }
}

const BEHAVIOUR_CHECKS = {
  'click-reloads-transactions': async (page, loc) => {
    // Set a filter first (known-good locator), then prove the candidate APPLIES it. A "Reset" button
    // would also reload the table, but without the filter – so it fails this check.
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('failed');
    const req = page.waitForRequest((r) => r.url().includes('/api/transactions'), { timeout: 3000 });
    await loc.click();
    const url = (await req).url();
    return { check: 'click → transactions re-requested with the chosen filter', pass: url.includes('status=failed'), detail: url.split('/api')[1] };
  },
  'select-keeps-value': async (page, loc) => {
    await loc.selectOption('failed');
    return { check: 'select "failed" → value is kept', pass: (await loc.inputValue()) === 'failed' };
  },
  'text-is-result-count': async (page, loc) => {
    const text = await loc.innerText();
    return { check: 'text looks like "Showing x–y of n transactions"', pass: /^Showing \d+–\d+ of \d+ transactions$/.test(text), detail: text };
  },
  'chart-has-data': async (page, loc) => {
    // eslint-disable-next-line no-undef
    const points = await loc.evaluate((el) => (window.Chart && Chart.getChart(el) ? Chart.getChart(el).data.datasets[0].data.length : 0));
    return { check: 'element is a live Chart.js chart with data', pass: points > 0, detail: `${points} points` };
  },
  'click-shows-transfer-feedback': async (page, loc) => {
    const res = page.waitForResponse((r) => r.url().includes('/api/transfers'), { timeout: 3000 });
    await loc.click(); // amount left empty on purpose → the API answers 400 and the form shows it
    await res;
    const text = await page.getByTestId('transfer-feedback').innerText();
    return { check: 'click → transfer request sent and feedback shown', pass: /Transfer (rejected|.*completed)/.test(text), detail: text.split('\n')[0] };
  },
};

async function validate(page, def, proposal) {
  const checks = [];
  let loc;
  try {
    loc = toLocator(page, proposal.locator);
  } catch (e) {
    return [{ check: 'allowed locator strategy', pass: false, detail: e.message }];
  }
  const count = await loc.count();
  checks.push({ check: 'resolves to exactly one element', pass: count === 1, detail: `count=${count}` });
  if (count !== 1) return checks;
  checks.push({ check: 'is visible', pass: await loc.isVisible() });
  if (def.expectedRole) {
    const handle = await loc.elementHandle();
    const hasRole = await page.getByRole(def.expectedRole).evaluateAll((els, target) => els.includes(target), handle);
    checks.push({ check: `has role "${def.expectedRole}"`, pass: hasRole });
  }
  try {
    checks.push(await BEHAVIOUR_CHECKS[def.validate](page, loc));
  } catch (e) {
    checks.push({ check: `behaviour (${def.validate})`, pass: false, detail: e.message.split('\n')[0] });
  }
  return checks;
}

module.exports = { detect, snapshot, propose, proposeHeuristically, validate, toCode, toLocator };
