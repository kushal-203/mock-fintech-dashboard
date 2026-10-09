const { parseNumber } = require('../../utils/parse');

// KPI tiles are <article aria-labelledby="..."> so they are reachable by role + accessible name.
class KpiCards {
  constructor(page) {
    this.page = page;
    this.region = page.getByRole('region', { name: 'Summary' });
  }

  card(name) {
    return this.region.getByRole('article', { name, exact: true });
  }

  async value(name) {
    return parseNumber(await this.card(name).locator('.kpi-value').innerText());
  }
}

module.exports = { KpiCards };
