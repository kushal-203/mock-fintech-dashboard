import { api, ApiClientError } from './api.js';
import { money, int, dateTime } from './format.js';
import { renderVolumeChart } from './chart.js';

const $ = (sel) => document.querySelector(sel);
const state = { page: 1, pageSize: 10, flaggedIds: new Set(), totalPages: 1 };

// Every value from the API is written with textContent, never innerHTML, so descriptions such as
// "<script>…" are displayed as text (XSS-safe).
function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function amountCell(amount, txnId) {
  const td = cell(money(amount), 'num');
  const id = document.createElement('span');
  id.className = 'sub-id';
  id.textContent = txnId;
  td.append(id);
  return td;
}

function setKpi(testid, value, sub) {
  const card = document.querySelector(`[data-testid="${testid}"]`);
  card.querySelector('.kpi-value').textContent = value;
  if (sub !== undefined) card.querySelector('.kpi-sub').textContent = sub;
}

async function loadSummary() {
  const s = await api.summary();
  setKpi('kpi-total-volume', money(s.totalVolume));
  setKpi('kpi-transactions', int(s.transactionCount),
    `${s.byStatus.completed} completed · ${s.byStatus.pending} pending · ${s.byStatus.failed} failed`);
  setKpi('kpi-active-accounts', int(s.activeAccounts));
  setKpi('kpi-flagged', int(s.flaggedRoundTrips));
}

async function loadChart() {
  renderVolumeChart($('#volume-chart'), await api.dailyVolume());
}

async function loadFlags() {
  const rt = await api.roundTrips();
  state.flaggedIds = new Set(rt.data.flatMap((d) => [d.outboundTxn, d.returnTxn]));
  const tbody = $('[data-testid="flags-table"] tbody');
  tbody.replaceChildren();
  if (!rt.data.length) {
    const tr = document.createElement('tr');
    const td = cell('No round-trip transfers detected', 'empty');
    td.colSpan = 5;
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const f of rt.data) {
    const tr = document.createElement('tr');
    tr.dataset.testid = 'flag-row';
    tr.dataset.outbound = f.outboundTxn;
    tr.dataset.return = f.returnTxn;
    tr.append(
      cell(`${f.accountA} ⇄ ${f.accountB}`),
      amountCell(f.amountSent, f.outboundTxn),
      amountCell(f.amountReturned, f.returnTxn),
      cell(`${f.pctDifference > 0 ? '+' : ''}${f.pctDifference}%`, 'num'),
      cell(`${f.hoursApart} h`, 'num'),
    );
    tbody.append(tr);
  }
}

function currentFilters() {
  const [sortBy, order] = $('#filter-sort').value.split(':');
  return {
    account: $('#filter-account').value,
    status: $('#filter-status').value,
    search: $('#filter-search').value.trim(),
    sortBy,
    order,
  };
}

async function loadTransactions() {
  const table = $('[data-testid="transactions-table"]');
  table.setAttribute('aria-busy', 'true');
  const result = await api.transactions({ ...currentFilters(), page: state.page, pageSize: state.pageSize });
  const tbody = table.querySelector('tbody');
  tbody.replaceChildren();

  if (!result.data.length) {
    const tr = document.createElement('tr');
    const td = cell('No transactions match these filters', 'empty');
    td.colSpan = 7;
    tr.append(td);
    tbody.append(tr);
  }
  for (const t of result.data) {
    const tr = document.createElement('tr');
    tr.dataset.testid = 'txn-row';
    tr.dataset.id = t.id;
    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${t.status}`;
    badge.textContent = t.status;
    statusTd.append(badge);
    if (state.flaggedIds.has(t.id)) {
      tr.classList.add('flagged');
      const flag = document.createElement('span');
      flag.className = 'badge flag';
      flag.textContent = 'Flagged';
      statusTd.append(' ', flag); // keep a space so the cell reads "completed Flagged"
    }
    tr.append(cell(t.id), cell(dateTime(t.createdAt)), cell(t.fromAccount), cell(t.toAccount),
      cell(t.description, 'desc'), cell(money(t.amount), 'num'), statusTd);
    tbody.append(tr);
  }

  const { page, pageSize, totalItems, totalPages } = result.pagination;
  state.totalPages = totalPages;
  const from = totalItems ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, totalItems);
  $('[data-testid="result-count"]').textContent = `Showing ${from}–${to} of ${totalItems} transactions`;
  $('[data-testid="page-indicator"]').textContent = `Page ${page} of ${totalPages}`;
  $('#prev-page').disabled = page <= 1;
  $('#next-page').disabled = page >= totalPages;
  table.setAttribute('aria-busy', 'false');
}

async function loadAccounts() {
  const accounts = await api.accounts();
  const opt = (a) => {
    const o = document.createElement('option');
    o.value = a.id;
    o.textContent = `${a.id} · ${a.holderName}`;
    return o;
  };
  $('#filter-account').append(...accounts.map(opt));
  $('#transfer-from').append(...accounts.map(opt));
  $('#transfer-to').append(...accounts.map(opt));
  $('#transfer-to').selectedIndex = 1;
}

function showTransferFeedback(kind, message, details = []) {
  const box = $('#transfer-feedback');
  box.className = `feedback ${kind}`;
  box.replaceChildren(document.createTextNode(message));
  if (details.length) {
    const ul = document.createElement('ul');
    for (const d of details) {
      const li = document.createElement('li');
      li.textContent = `${d.field}: ${d.message}`;
      ul.append(li);
    }
    box.append(ul);
  }
}

async function submitTransfer(event) {
  event.preventDefault();
  const form = event.target;
  const amountRaw = form.amount.value;
  const payload = {
    fromAccount: form.fromAccount.value,
    toAccount: form.toAccount.value,
    amount: amountRaw === '' ? undefined : Number(amountRaw),
  };
  if (form.description.value) payload.description = form.description.value;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { data } = await api.transfer(payload);
    showTransferFeedback('success', `Transfer ${data.id} completed: ${money(data.amount)} from ${data.fromAccount} to ${data.toAccount}.`);
    form.amount.value = '';
    form.description.value = '';
    await refreshAll();
  } catch (err) {
    if (err instanceof ApiClientError) {
      showTransferFeedback('error', `Transfer rejected (${err.status}): ${err.message}`, err.body?.error?.details || []);
    } else {
      showTransferFeedback('error', 'Network error – please try again.');
    }
  } finally {
    button.disabled = false;
  }
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadChart(), loadFlags()]);
  await loadTransactions();
}

function wireEvents() {
  $('#filters').addEventListener('submit', (e) => { e.preventDefault(); state.page = 1; loadTransactions(); });
  $('#reset-filters').addEventListener('click', () => { $('#filters').reset(); state.page = 1; loadTransactions(); });
  $('#prev-page').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; loadTransactions(); } });
  $('#next-page').addEventListener('click', () => { if (state.page < state.totalPages) { state.page += 1; loadTransactions(); } });
  $('#transfer-form').addEventListener('submit', submitTransfer);
}

(async function init() {
  wireEvents();
  try {
    await loadAccounts();
    await refreshAll();
    document.body.dataset.ready = 'true';
  } catch (err) {
    console.error(err);
    $('#main').prepend(Object.assign(document.createElement('p'), { className: 'feedback error', role: 'alert', textContent: 'Could not load dashboard data.' }));
  }
}());
