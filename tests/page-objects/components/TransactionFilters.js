class TransactionFilters {
  constructor(page) {
    this.page = page;
    this.form = page.getByRole('form', { name: 'Transaction filters' });
    this.account = this.form.getByLabel('Account', { exact: true });
    this.status = this.form.getByLabel('Status', { exact: true });
    this.search = this.form.getByLabel('Search', { exact: true });
    this.sortBy = this.form.getByLabel('Sort by', { exact: true });
    this.applyButton = this.form.getByRole('button', { name: 'Apply filters' });
    this.resetButton = this.form.getByRole('button', { name: 'Reset' });
  }

  static sortValue(label) {
    const map = { 'Newest first': 'date:desc', 'Oldest first': 'date:asc', 'Amount: high to low': 'amount:desc', 'Amount: low to high': 'amount:asc' };
    if (!map[label]) throw new Error(`Unknown sort option "${label}"`);
    return map[label];
  }

  async set({ account, status, search, sort } = {}) {
    if (account !== undefined) await this.account.selectOption(account === 'All' ? '' : account);
    if (status !== undefined) await this.status.selectOption(status === 'All' ? '' : status.toLowerCase());
    if (search !== undefined) await this.search.fill(search);
    if (sort !== undefined) await this.sortBy.selectOption(TransactionFilters.sortValue(sort));
  }
}

module.exports = { TransactionFilters };
