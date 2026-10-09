const path = require('path');
const express = require('express');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb', strict: false }));

  app.use('/api', routes);
  app.use('/api', notFoundHandler);

  // Front end + the Chart.js build served locally (works offline, no CDN).
  const chartJsFile = path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.min.js');
  app.get('/vendor/chart.umd.min.js', (req, res) => res.sendFile(chartJsFile));
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
