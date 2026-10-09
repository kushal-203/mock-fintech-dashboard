// Thin client for the backend REST API. Throws ApiClientError with the server's error body.
export class ApiClientError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, { headers: { Accept: 'application/json', ...options.headers }, ...options });
  let body = null;
  try { body = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw new ApiClientError(res.status, body);
  return body;
}

export const api = {
  summary: () => request('/summary').then((b) => b.data),
  accounts: () => request('/accounts').then((b) => b.data),
  dailyVolume: () => request('/analytics/daily-volume').then((b) => b.data),
  roundTrips: () => request('/analytics/round-trips'),
  transactions: (params) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    return request(`/transactions?${qs}`);
  },
  transfer: (payload) => request('/transfers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
};
