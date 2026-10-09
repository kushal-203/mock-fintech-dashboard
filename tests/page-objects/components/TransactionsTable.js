const { parseNumber } = require('../../utils/parse');

class TransactionsTable {
  constructor(page) {
    this.page = page;
    this.table = page.getByRole('table', { name: 'Transactions', exact: true });
    this.rows = this.table.getByTestId('txn-row');
    this.resultCount = page.getByTestId('result-count');
    this.pageIndicator = page.getByTestId('page-indicator');
    const pager = page.getByRole('navigation', { name: 'Pagination' });
    this.nextButton = pager.getByRole('button', { name: 'Next' });
    this.previousButton = pager.getByRole('button', { name: 'Previous' });
    this.emptyMessage = this.table.getByText('No transactions match these filters');
  }

  /** Runs an action that reloads the table and waits until the new data is rendered. */
  async reloadVia(action) {
    const response = this.page.waitForResponse((r) => r.url().includes('/api/transactions') && r.request().method() === 'GET');
    await action();
    await response;
    await this.page.locator('[data-testid="transactions-table"][aria-busy="false"]').waitFor({ state: 'attached' });
  }

  /** Visible rows as objects keyed by column header. */
  async data() {
    const headers = await this.table.getByRole('columnheader').allInnerTexts();
    const rows = await this.rows.all();
    return Promise.all(rows.map(async (row) => {
      const cells = await row.getByRole('cell').allInnerTexts();
      const obj = Object.fromEntries(headers.map((h, i) => [h.trim().toLowerCase(), cells[i].trim()]));
      obj.amountValue = parseNumber(obj.amount);
      obj.statusValue = (obj.status.match(/^(completed|pending|failed)/) || [''])[0];
      obj.flagged = /Flagged/.test(obj.status);
      return obj;
    }));
  }

  async totalFromCount() {
    const m = (await this.resultCount.innerText()).match(/of (\d+) transactions/);
    if (!m) throw new Error('Could not read the result count');
    return Number(m[1]);
  }
}

module.exports = { TransactionsTable };
