// Common request/response handling for API service objects.
class BaseApi {
  /** @param {import('playwright').APIRequestContext} request */
  constructor(request) {
    this.request = request;
  }

  async toResult(response, started) {
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return {
      status: response.status(),
      headers: response.headers(),
      text,
      json,
      elapsedMs: Date.now() - started,
    };
  }
}

module.exports = { BaseApi };
