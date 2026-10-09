const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = (n) => usd.format(n);
export const int = (n) => new Intl.NumberFormat('en-US').format(n);
export const dateTime = (iso) => iso.replace('T', ' ').replace(/:\d\dZ$/, '');
