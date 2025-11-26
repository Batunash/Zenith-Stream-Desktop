const mediaService = require('../services/mediaService');

async function listSeries(req, res) {
  try {
    const userId = req.user?.id; 
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const series = mediaService.getSeries(userId, baseUrl);
    res.json({ series });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERIES_LIST_FAILED' });
  }
}
async function getSeriesEpisodes(req, res) {
  try {
    const { seriesId } = req.params;
    const userId = req.user?.id;
    const episodes = mediaService.getEpisodesBySeries(seriesId, userId);
    res.json({ episodes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'EPISODES_LIST_FAILED' });
  }
}
module.exports = {
  listSeries,
  getSeriesEpisodes
};
