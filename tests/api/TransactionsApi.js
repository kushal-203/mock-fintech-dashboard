const { BaseApi } = require('./BaseApi');

class TransactionsApi extends BaseApi {
  async list(params = {}) {
    const started = Date.now();
    return this.toResult(await this.request.get('transactions', { params }), started);
  }

  /** GET with a raw query string, e.g. "page=1&page=2" (repeated keys can't be expressed as an object). */
  async listRaw(query) {
    const started = Date.now();
    return this.toResult(await this.request.get(`transactions${query ? `?${query}` : ''}`), started);
  }

  async roundTripsRaw(query) {
    const started = Date.now();
    return this.toResult(await this.request.get(`analytics/round-trips${query ? `?${query}` : ''}`), started);
  }

  /** Every transaction, walking all pages (used as raw data for independent expectations). */
  async all(params = {}) {
    const items = [];
    for (let page = 1; ; page += 1) {
      const res = await this.list({ ...params, page, pageSize: 100 });
      if (res.status !== 200) throw new Error(`GET /transactions failed: ${res.status} ${res.text}`);
      items.push(...res.json.data);
      if (page >= res.json.pagination.totalPages) return items;
    }
  }

  async roundTrips(params = {}) {
    const started = Date.now();
    return this.toResult(await this.request.get('analytics/round-trips', { params }), started);
  }

  async summary() {
    const started = Date.now();
    return this.toResult(await this.request.get('summary'), started);
  }
}

module.exports = { TransactionsApi };
