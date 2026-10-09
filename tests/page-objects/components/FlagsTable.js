class FlagsTable {
  constructor(page) {
    this.table = page.getByRole('table', { name: 'Flagged round-trip transfers' });
    this.rows = this.table.getByTestId('flag-row');
  }

  async pairs() {
    return this.rows.evaluateAll((rows) => rows.map((r) => ({ outboundTxn: r.dataset.outbound, returnTxn: r.dataset.return })));
  }
}

module.exports = { FlagsTable };
