const { validateRoundTripQuery } = require('../validators/roundTripQuery');
const analytics = require('../services/analyticsService');

exports.roundTrips = (req, res) => res.json(analytics.roundTrips(validateRoundTripQuery(req.query)));
exports.dailyVolume = (req, res) => res.json({ data: analytics.dailyVolume() });
exports.summary = (req, res) => res.json({ data: analytics.summary() });
