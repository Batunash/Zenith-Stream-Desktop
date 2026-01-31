const { MEDIA_DIR } = require('../config/config');
const { VIDEO_EXTS } = require('../constants') || { VIDEO_EXTS: ['.mp4', '.mkv', '.avi'] };
const db = require('../config/database');

function initializeDatabase() {
  try {
    const db = require('../config/database');
    const config = require('../config/config');
    const { VIDEO_EXTS } = require('../constants');

    db.syncFilesystemToDatabase(config.MEDIA_DIR, VIDEO_EXTS);
    console.log('Database sync OK. Media Dir:', config.MEDIA_DIR);
  } catch (error) {
    console.error('Sync Error:', error);
  }
}
function formatDuration(seconds) {
    if(!seconds) return "0m";
    const m = Math.floor(seconds / 60);
    return `${m}m`;
}

function getSeries(userId = null, baseUrl = '') {
  try {
    const seriesList = userId ? db.getSeriesWithUserProgress(userId) : db.getAllSeries();

    return seriesList.map(s => {
      let posterUrl = null;
      if (s.POSTER_PATH) {
          posterUrl = s.POSTER_PATH.startsWith('http') ? s.POSTER_PATH : (baseUrl + s.POSTER_PATH);
      }
      let backdropUrl = null;
      if (s.BACKDROP_PATH) {
          backdropUrl = s.BACKDROP_PATH.startsWith('http') ? s.BACKDROP_PATH : (baseUrl + s.BACKDROP_PATH);
      }
      return {
        id: s.ID,
        title: s.TITLE,
        poster: posterUrl,    
        backdrop: backdropUrl, 
        rating: s.RATING,
        description: s.OVERVIEW,
        seasons: db.getSeasonsWithEpisodes(s.ID, userId).map(season => ({
        id: season.ID,
        title: season.NAME,       
        order: season.SEASON_NUMBER,
        episodes: season.episodes.map(ep => ({
        id: ep.ID,
        title: ep.NAME,       
        number: ep.EPISODE_NUMBER,
        duration: formatDuration(ep.DURATION),
        streamUrl: `/api/stream/${ep.ID}`,
        watched: ep.watched || false,
        progress: ep.progress || 0,
        watchTime: ep.watchTime || 0
            }))
        }))
      };
    });
  } catch (error) {
    console.error('Error getting series:', error);
    throw error;
  }
}
function getEpisodesBySeries(serieId, userId = null) {
  try {
    const episodes = db.getEpisodesBySeries(serieId);
    return episodes.map(ep => {
      return ep; 
    });
  } catch (error) {
    console.error('Error getting episodes:', error);
    throw error;
  }
}

module.exports = {
  getSeries,
  getEpisodesBySeries,
  initializeDatabase,
  db 
};