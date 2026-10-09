const { BaseApi } = require('./BaseApi');

class TransfersApi extends BaseApi {
  /** POST /transfers with a JS object (serialised to JSON). */
  async create(payload) {
    const started = Date.now();
    const res = await this.request.post('transfers', { data: payload, headers: { 'Content-Type': 'application/json' } });
    return this.toResult(res, started);
  }

  /** POST /transfers with an exact raw body and content type (malformed JSON, wrong media type...). */
  async createRaw(body, contentType = 'application/json') {
    const started = Date.now();
    const res = await this.request.post('transfers', { data: Buffer.from(body, 'utf8'), headers: { 'Content-Type': contentType } });
    return this.toResult(res, started);
  }
}

module.exports = { TransfersApi };
