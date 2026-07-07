const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { optionalAuth } = require('../middleware/auth');

router.get('/series', optionalAuth, mediaController.listSeries);
router.get('/series/:seriesId/episodes', optionalAuth, mediaController.getSeriesEpisodes);

module.exports = router;
