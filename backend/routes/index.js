const express = require('express');
const tx = require('../controllers/transactionsController');
const analytics = require('../controllers/analyticsController');
const { resetDb } = require('../db/connection');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.get('/transactions', tx.list);
router.post('/transfers', tx.createTransfer);
router.get('/accounts', tx.accounts);
router.get('/summary', analytics.summary);
router.get('/analytics/round-trips', analytics.roundTrips);
router.get('/analytics/daily-volume', analytics.dailyVolume);

// Test-only: restore the seed data between scenarios. Never enabled unless explicitly configured.
if (process.env.ENABLE_TEST_ROUTES === 'true') {
  router.post('/test/reset', (req, res) => { resetDb(); res.json({ status: 'reset' }); });
}

module.exports = router;
