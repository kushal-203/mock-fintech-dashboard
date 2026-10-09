const { setWorldConstructor, World, setDefaultTimeout } = require('@cucumber/cucumber');
const config = require('../config/config');
const { DashboardPage } = require('../page-objects/DashboardPage');
const { TransfersApi } = require('../api/TransfersApi');
const { TransactionsApi } = require('../api/TransactionsApi');

setDefaultTimeout(config.defaultTimeout * 6);

class CustomWorld extends World {
  constructor(options) {
    super(options);
    this.config = config;
    this.page = null;   // Playwright Page (UI scenarios)
    this.api = null;    // Playwright APIRequestContext (API scenarios + test oracles)
    this.ctx = {};      // scenario-scoped data shared between steps
  }

  get dashboard() { return (this._dashboard ||= new DashboardPage(this.page)); }
  get transfersApi() { return (this._transfersApi ||= new TransfersApi(this.api)); }
  get transactionsApi() { return (this._transactionsApi ||= new TransactionsApi(this.api)); }
}

setWorldConstructor(CustomWorld);
