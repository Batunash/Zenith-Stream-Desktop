const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
class DatabaseManager {
  constructor() {
  let dbPath;

    if (app.isPackaged) {
        dbPath = path.join(app.getPath('userData'), 'video-hub.db');
    } else {
        dbPath = path.join(__dirname, '../../../../video-hub.db');
    }
    console.log("Veritabanı Yolu:", dbPath);
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.initializeTables();
  }
  initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS USERS (ID INTEGER PRIMARY KEY AUTOINCREMENT, USERNAME TEXT UNIQUE, PASSWORD TEXT, CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS SERIES (ID INTEGER PRIMARY KEY AUTOINCREMENT, TITLE TEXT, FOLDER_PATH TEXT UNIQUE, POSTER_PATH TEXT, BACKDROP_PATH TEXT, OVERVIEW TEXT, RATING TEXT, TMDB_ID INTEGER, CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS SEASONS (ID INTEGER PRIMARY KEY AUTOINCREMENT, SERIE_ID INTEGER NOT NULL, SEASON_NUMBER INTEGER NOT NULL, NAME TEXT, FOLDER_PATH TEXT, FOREIGN KEY(SERIE_ID) REFERENCES SERIES(ID) ON DELETE CASCADE, UNIQUE(SERIE_ID, SEASON_NUMBER));
      CREATE TABLE IF NOT EXISTS EPISODES (ID INTEGER PRIMARY KEY AUTOINCREMENT, SEASON_ID INTEGER NOT NULL, EPISODE_NUMBER INTEGER NOT NULL, NAME TEXT NOT NULL, FILE_PATH TEXT NOT NULL, FILE_SIZE INTEGER, DURATION INTEGER, CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(SEASON_ID) REFERENCES SEASONS(ID) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS WATCH_HISTORY (USER_ID INTEGER NOT NULL, EPISODE_ID INTEGER NOT NULL, PROGRESS REAL DEFAULT 0, WATCH_TIME INTEGER DEFAULT 0, WATCHED_AT DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(USER_ID, EPISODE_ID));
    `);
  }

  getUserByUsername(username) { return this.db.prepare('SELECT * FROM USERS WHERE USERNAME = ?').get(username); }
  getUserById(id) { return this.db.prepare('SELECT * FROM USERS WHERE ID = ?').get(id); }
  createUser(username, password) { return this.db.prepare('INSERT INTO USERS (USERNAME, PASSWORD) VALUES (?, ?)').run(username, password); }

  getAllSeries() { return this.db.prepare('SELECT * FROM SERIES ORDER BY TITLE').all(); }
  getSeriesWithUserProgress(userId) { return this.getAllSeries(); }
  getSeasonsWithEpisodes(serieId, userId = null) {
   const seasons = this.db.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? ORDER BY SEASON_NUMBER').all(serieId);
    
    for (const season of seasons) {
        const episodes = this.db.prepare('SELECT * FROM EPISODES WHERE SEASON_ID = ? ORDER BY EPISODE_NUMBER').all(season.ID);
        
        if (userId) {
            season.episodes = episodes.map(ep => {
                const history = this.db.prepare('SELECT * FROM WATCH_HISTORY WHERE USER_ID = ? AND EPISODE_ID = ?').get(userId, ep.ID);
                return { 
                    ...ep, 
                    progress: history ? history.PROGRESS : 0,
                    watchTime: history ? history.WATCH_TIME : 0,
                    watched: history ? (history.PROGRESS > 0.9) : false
                };
            });
        } else {
            season.episodes = episodes;
        }
    }
    return seasons;
  }
  getEpisodesBySeries(serieId) {
    const seasons = this.db.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? ORDER BY SEASON_NUMBER').all(serieId);
    let allEpisodes = [];
    for (const season of seasons) {
        const episodes = this.db.prepare('SELECT * FROM EPISODES WHERE SEASON_ID = ? ORDER BY EPISODE_NUMBER').all(season.ID);
        const episodesWithMeta = episodes.map(ep => ({
            ...ep, SEASON_NUMBER: season.SEASON_NUMBER, SERIE_ID: serieId,
            SERIE_NAME: this.db.prepare('SELECT TITLE FROM SERIES WHERE ID = ?').get(serieId).TITLE,
            EPISODE_NAME: ep.NAME, EPISODE_NUMBER: ep.EPISODE_NUMBER, EPISODE_ID: ep.ID
        }));
        allEpisodes = [...allEpisodes, ...episodesWithMeta];
    }
    return allEpisodes;
  }
  getEpisodeBySeriesAndFile(seriesName, fileName) {
    const serie = this.db.prepare('SELECT ID FROM SERIES WHERE TITLE = ?').get(seriesName);
    if (!serie) return null;
    const seasons = this.db.prepare('SELECT ID FROM SEASONS WHERE SERIE_ID = ?').all(serie.ID);
    if (seasons.length === 0) return null;
    const seasonIds = seasons.map(s => s.ID);
    const episode = this.db.prepare(`
        SELECT * FROM EPISODES 
        WHERE SEASON_ID IN (${seasonIds.join(',')}) AND NAME = ?
    `).get(fileName);
    return episode;
  }

  getEpisodeById(id) { return this.db.prepare('SELECT * FROM EPISODES WHERE ID = ?').get(id); }
  
  getUserEpisodeProgress(userId, episodeId) { return this.db.prepare('SELECT * FROM WATCH_HISTORY WHERE USER_ID = ? AND EPISODE_ID = ?').get(userId, episodeId); }
  
  updateWatchProgress(userId, episodeId, progress, watchTime) {
      return this.db.prepare(`
        INSERT INTO WATCH_HISTORY (USER_ID, EPISODE_ID, PROGRESS, WATCH_TIME, WATCHED_AT) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(USER_ID, EPISODE_ID) DO UPDATE SET PROGRESS=excluded.PROGRESS, WATCH_TIME=excluded.WATCH_TIME, WATCHED_AT=CURRENT_TIMESTAMP
      `).run(userId, episodeId, progress, watchTime);
  }

  deleteSeriesByPath(p) { this.db.prepare('DELETE FROM SERIES WHERE FOLDER_PATH = ?').run(p); }
  deleteSeasonByPath(p) { this.db.prepare('DELETE FROM SEASONS WHERE FOLDER_PATH = ?').run(p); }
  deleteEpisodeByPath(p) { this.db.prepare('DELETE FROM EPISODES WHERE FILE_PATH = ?').run(p); }
  syncFilesystemToDatabase(mediaDir, videoExts) {
    if (!fs.existsSync(mediaDir)) return;
    const syncTransaction = this.db.transaction(() => {
        const seriesFolders = fs.readdirSync(mediaDir, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const serieDir of seriesFolders) {
            const seriePath = path.join(mediaDir, serieDir.name);
            const metaPath = path.join(seriePath, 'metadata.json');
            let title = serieDir.name, poster = null, backdrop = null, overview = null, rating = null, tmdbId = null;
            if (fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    title = meta.title || serieDir.name;
                    poster = meta.localPoster ? `/images/${encodeURIComponent(serieDir.name)}/${meta.localPoster}` : null;
                    backdrop = meta.backdrop || null; overview = meta.overview || null; rating = meta.rating || null; tmdbId = meta.id || null;
                } catch (e) {}
            }
            let serie = this.db.prepare('SELECT * FROM SERIES WHERE FOLDER_PATH = ?').get(seriePath);
            if (!serie) {
                const info = this.db.prepare('INSERT INTO SERIES (TITLE, FOLDER_PATH, POSTER_PATH, BACKDROP_PATH, OVERVIEW, RATING, TMDB_ID) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, seriePath, poster, backdrop, overview, rating, tmdbId);
                serie = { ID: info.lastInsertRowid };
            }
            const seasonFolders = fs.readdirSync(seriePath, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('Season'));
            for (const seasonDir of seasonFolders) {
                const seasonPath = path.join(seriePath, seasonDir.name);
                const seasonNum = parseInt(seasonDir.name.replace(/\D/g, '')) || 0;
                let season = this.db.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? AND SEASON_NUMBER = ?').get(serie.ID, seasonNum);
                if (!season) {
                    const info = this.db.prepare('INSERT INTO SEASONS (SERIE_ID, SEASON_NUMBER, NAME, FOLDER_PATH) VALUES (?, ?, ?, ?)').run(serie.ID, seasonNum, seasonDir.name, seasonPath);
                    season = { ID: info.lastInsertRowid };
                }
                const files = fs.readdirSync(seasonPath).filter(f => videoExts.includes(path.extname(f).toLowerCase()));
                files.forEach((file, index) => {
                    const filePath = path.join(seasonPath, file);
                    const stats = fs.statSync(filePath);
                    const exists = this.db.prepare('SELECT ID FROM EPISODES WHERE SEASON_ID = ? AND FILE_PATH = ?').get(season.ID, filePath);
                    if (!exists) {
                        this.db.prepare('INSERT INTO EPISODES (SEASON_ID, EPISODE_NUMBER, NAME, FILE_PATH, FILE_SIZE) VALUES (?, ?, ?, ?, ?)').run(season.ID, index + 1, file, filePath, stats.size);
                    }
                });
            }
        }
    });
    syncTransaction();
  }
}

module.exports = new DatabaseManager();