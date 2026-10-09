const { BasePage } = require('./BasePage');
const { KpiCards } = require('./components/KpiCards');
const { VolumeChart } = require('./components/VolumeChart');
const { TransactionFilters } = require('./components/TransactionFilters');
const { TransactionsTable } = require('./components/TransactionsTable');
const { FlagsTable } = require('./components/FlagsTable');
const { TransferForm } = require('./components/TransferForm');

/** The single-page dashboard, composed of component objects. */
class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
    this.title = this.heading('Transaction Dashboard');
    this.kpis = new KpiCards(page);
    this.chart = new VolumeChart(page);
    this.filters = new TransactionFilters(page);
    this.transactions = new TransactionsTable(page);
    this.flags = new FlagsTable(page);
    this.transferForm = new TransferForm(page);
  }

  async applyFilters(filters) {
    await this.filters.set(filters);
    await this.transactions.reloadVia(() => this.filters.applyButton.click());
  }
}

module.exports = { DashboardPage };
