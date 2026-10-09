const { createApp } = require('./app');
const { getDb } = require('./db/connection');

function start(port = Number(process.env.PORT) || 4000) {
  getDb(); // fail fast if migrations/seeds are broken
  return new Promise((resolve, reject) => {
    const server = createApp().listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

if (require.main === module) {
  start().then((s) => console.log(`Mock FinTech Dashboard running at http://localhost:${s.address().port}`));
}

module.exports = { start };
