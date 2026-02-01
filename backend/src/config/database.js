const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.SQL = null;
    if (app.isPackaged) {
      this.dbPath = path.join(app.getPath('userData'), 'video-hub.sqlite');
    } else {
      this.dbPath = path.join(__dirname, '../../../../video-hub.sqlite');
    }
    console.log("Veritabanı Yolu:", this.dbPath);
    this.initPromise = this.init();
  }

  async init() {
    this.SQL = await initSqlJs({});

    if (fs.existsSync(this.dbPath)) {
      const filebuffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(filebuffer);
    } else {
      this.db = new this.SQL.Database();
      this.save();
    }

    this.initializeTables();
  }

  save() {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  prepare(sql) {
    if (!this.db) {
      console.warn("DB not ready yet");
      return { run: () => {}, get: () => {}, all: () => [] };
    }

    const stmt = this.db.prepare(sql);
    const self = this;

    return {
      run: function(...args) {
        stmt.bind(args);
        stmt.step();
        stmt.free();
        self.save();
        return { lastInsertRowid: self.db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
      },
      get: function(...args) {
        stmt.bind(args);
        const hasRow = stmt.step();
        let result = null;
        if (hasRow) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all: function(...args) {
        stmt.bind(args);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql) {
    if (this.db) {
      this.db.run(sql);
      this.save();
    }
  }

  transaction(func) {
    return () => {
      func();
      this.save();
    }
  }

  initializeTables() {
    this.exec(`
      CREATE TABLE IF NOT EXISTS USERS (ID INTEGER PRIMARY KEY AUTOINCREMENT, USERNAME TEXT UNIQUE, PASSWORD TEXT, CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS SERIES (ID INTEGER PRIMARY KEY AUTOINCREMENT, TITLE TEXT, FOLDER_PATH TEXT UNIQUE, POSTER_PATH TEXT, BACKDROP_PATH TEXT, OVERVIEW TEXT, RATING TEXT, TMDB_ID INTEGER, TYPE TEXT DEFAULT 'serie',CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS SEASONS (ID INTEGER PRIMARY KEY AUTOINCREMENT, SERIE_ID INTEGER NOT NULL, SEASON_NUMBER INTEGER NOT NULL, NAME TEXT, FOLDER_PATH TEXT, FOREIGN KEY(SERIE_ID) REFERENCES SERIES(ID) ON DELETE CASCADE, UNIQUE(SERIE_ID, SEASON_NUMBER));
      CREATE TABLE IF NOT EXISTS EPISODES (ID INTEGER PRIMARY KEY AUTOINCREMENT, SEASON_ID INTEGER NOT NULL, EPISODE_NUMBER INTEGER NOT NULL, NAME TEXT NOT NULL, FILE_PATH TEXT NOT NULL, FILE_SIZE INTEGER, DURATION INTEGER, CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(SEASON_ID) REFERENCES SEASONS(ID) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS WATCH_HISTORY (USER_ID INTEGER NOT NULL, EPISODE_ID INTEGER NOT NULL, PROGRESS REAL DEFAULT 0, WATCH_TIME INTEGER DEFAULT 0, WATCHED_AT DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(USER_ID, EPISODE_ID));
    `);
  }

  getUserByUsername(username) { return this.prepare('SELECT * FROM USERS WHERE USERNAME = ?').get(username); }
  getUserById(id) { return this.prepare('SELECT * FROM USERS WHERE ID = ?').get(id); }
  createUser(username, password) { return this.prepare('INSERT INTO USERS (USERNAME, PASSWORD) VALUES (?, ?)').run(username, password); }

  getAllSeries() { return this.prepare('SELECT * FROM SERIES ORDER BY TITLE').all(); }
  getSeriesWithUserProgress(userId) { return this.getAllSeries(); }

  getSeasonsWithEpisodes(serieId, userId = null) {
    const seasons = this.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? ORDER BY SEASON_NUMBER').all(serieId);

    for (const season of seasons) {
      const episodes = this.prepare('SELECT * FROM EPISODES WHERE SEASON_ID = ? ORDER BY EPISODE_NUMBER').all(season.ID);

      if (userId) {
        season.episodes = episodes.map(ep => {
          const history = this.prepare('SELECT * FROM WATCH_HISTORY WHERE USER_ID = ? AND EPISODE_ID = ?').get(userId, ep.ID);
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
    const seasons = this.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? ORDER BY SEASON_NUMBER').all(serieId);
    let allEpisodes = [];
    for (const season of seasons) {
      const episodes = this.prepare('SELECT * FROM EPISODES WHERE SEASON_ID = ? ORDER BY EPISODE_NUMBER').all(season.ID);
      const episodesWithMeta = episodes.map(ep => ({
        ...ep, SEASON_NUMBER: season.SEASON_NUMBER, SERIE_ID: serieId,
        SERIE_NAME: this.prepare('SELECT TITLE FROM SERIES WHERE ID = ?').get(serieId).TITLE,
        EPISODE_NAME: ep.NAME, EPISODE_NUMBER: ep.EPISODE_NUMBER, EPISODE_ID: ep.ID
      }));
      allEpisodes = [...allEpisodes, ...episodesWithMeta];
    }
    return allEpisodes;
  }

  getEpisodeBySeriesAndFile(seriesName, fileName) {
    const serie = this.prepare('SELECT ID FROM SERIES WHERE TITLE = ?').get(seriesName);
    if (!serie) return null;
    const seasons = this.prepare('SELECT ID FROM SEASONS WHERE SERIE_ID = ?').all(serie.ID);
    if (seasons.length === 0) return null;
    const seasonIds = seasons.map(s => s.ID);
    if (seasonIds.length === 0) return null;

    const episode = this.prepare(`
        SELECT * FROM EPISODES 
        WHERE SEASON_ID IN (${seasonIds.join(',')}) AND NAME = ?
    `).get(fileName);
    return episode;
  }

  getEpisodeById(id) { return this.prepare('SELECT * FROM EPISODES WHERE ID = ?').get(id); }

  getUserEpisodeProgress(userId, episodeId) { return this.prepare('SELECT * FROM WATCH_HISTORY WHERE USER_ID = ? AND EPISODE_ID = ?').get(userId, episodeId); }

  updateWatchProgress(userId, episodeId, progress, watchTime) {
    return this.prepare(`
        INSERT INTO WATCH_HISTORY (USER_ID, EPISODE_ID, PROGRESS, WATCH_TIME, WATCHED_AT) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(USER_ID, EPISODE_ID) DO UPDATE SET PROGRESS=excluded.PROGRESS, WATCH_TIME=excluded.WATCH_TIME, WATCHED_AT=CURRENT_TIMESTAMP
      `).run(userId, episodeId, progress, watchTime);
  }

  deleteSeriesByPath(p) { this.prepare('DELETE FROM SERIES WHERE FOLDER_PATH = ?').run(p); }
  deleteSeasonByPath(p) { this.prepare('DELETE FROM SEASONS WHERE FOLDER_PATH = ?').run(p); }
  deleteEpisodeByPath(p) { this.prepare('DELETE FROM EPISODES WHERE FILE_PATH = ?').run(p); }
syncFilesystemToDatabase(mediaDir, videoExts) {
    if (!fs.existsSync(mediaDir)) return;
    const syncTransaction = this.transaction(() => {
      const seriesFolders = fs.readdirSync(mediaDir, { withFileTypes: true }).filter(d => d.isDirectory());

      for (const dir of seriesFolders) {
        const contentPath = path.join(mediaDir, dir.name);
        const metaPath = path.join(contentPath, 'metadata.json');
        let title = dir.name;
        let type = 'serie';
        let poster = null, backdrop = null, overview = null, rating = null, tmdbId = null;

        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            title = meta.title || dir.name;
            type = meta.type || 'serie';
            poster = meta.localPoster ? `/images/${encodeURIComponent(dir.name)}/${meta.localPoster}` : null;
            backdrop = meta.backdrop || null;
            overview = meta.overview || null;
            rating = meta.rating || null;
            tmdbId = meta.id || null;
          } catch (e) {}
        }

        let serie = this.prepare('SELECT * FROM SERIES WHERE TITLE = ?').get(title);
        if (!serie) {
          const info = this.prepare('INSERT INTO SERIES (TITLE, FOLDER_PATH, POSTER_PATH, BACKDROP_PATH, OVERVIEW, RATING, TMDB_ID, TYPE) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(title, contentPath, poster, backdrop, overview, rating, tmdbId, type);
          serie = { ID: info.lastInsertRowid };
        } else {
          this.prepare('UPDATE SERIES SET FOLDER_PATH = ? WHERE ID = ?').run(contentPath, serie.ID);
        }

        if (type === 'movie') {
          let season = this.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? AND SEASON_NUMBER = 1').get(serie.ID);
          if (!season) {
            const info = this.prepare('INSERT INTO SEASONS (SERIE_ID, SEASON_NUMBER, NAME, FOLDER_PATH) VALUES (?, ?, ?, ?)').run(serie.ID, 1, "Film", contentPath);
            season = { ID: info.lastInsertRowid };
          } else {
            this.prepare('UPDATE SEASONS SET FOLDER_PATH = ? WHERE ID = ?').run(contentPath, season.ID);
          }
          const files = fs.readdirSync(contentPath).filter(f => videoExts.includes(path.extname(f).toLowerCase()));
          if (files.length > 0) {
            const file = files[0];
            const filePath = path.join(contentPath, file);
            const stats = fs.statSync(filePath);
            const exists = this.prepare('SELECT ID FROM EPISODES WHERE SEASON_ID = ?').get(season.ID);
            if (!exists) {
              this.prepare('INSERT INTO EPISODES (SEASON_ID, EPISODE_NUMBER, NAME, FILE_PATH, FILE_SIZE) VALUES (?, ?, ?, ?, ?)').run(season.ID, 1, title, filePath, stats.size);
            } else {
              this.prepare('UPDATE EPISODES SET FILE_PATH = ?, FILE_SIZE = ? WHERE ID = ?').run(filePath, stats.size, exists.ID);
            }
          }
        } else {
          const seasonFolders = fs.readdirSync(contentPath, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('Season'));
          for (const seasonDir of seasonFolders) {
            const seasonPath = path.join(contentPath, seasonDir.name);
            const seasonNum = parseInt(seasonDir.name.replace(/\D/g, '')) || 0;
            let season = this.prepare('SELECT * FROM SEASONS WHERE SERIE_ID = ? AND SEASON_NUMBER = ?').get(serie.ID, seasonNum);
            if (!season) {
              const info = this.prepare('INSERT INTO SEASONS (SERIE_ID, SEASON_NUMBER, NAME, FOLDER_PATH) VALUES (?, ?, ?, ?)').run(serie.ID, seasonNum, seasonDir.name, seasonPath);
              season = { ID: info.lastInsertRowid };
            } else {
              this.prepare('UPDATE SEASONS SET FOLDER_PATH = ? WHERE ID = ?').run(seasonPath, season.ID);
            }
            const files = fs.readdirSync(seasonPath).filter(f => videoExts.includes(path.extname(f).toLowerCase()));
            files.forEach((file, index) => {
              const filePath = path.join(seasonPath, file);
              const stats = fs.statSync(filePath);
              const exists = this.prepare('SELECT ID FROM EPISODES WHERE SEASON_ID = ? AND NAME = ?').get(season.ID, file);
              if (!exists) {
                this.prepare('INSERT INTO EPISODES (SEASON_ID, EPISODE_NUMBER, NAME, FILE_PATH, FILE_SIZE) VALUES (?, ?, ?, ?, ?)').run(season.ID, index + 1, file, filePath, stats.size);
              } else {
                this.prepare('UPDATE EPISODES SET FILE_PATH = ?, FILE_SIZE = ? WHERE ID = ?').run(filePath, stats.size, exists.ID);
              }
            });
          }
        }
      }
      this.prepare("SELECT ID, FILE_PATH FROM EPISODES").all().forEach(ep => {
        if (ep.FILE_PATH && !fs.existsSync(ep.FILE_PATH)) this.prepare("DELETE FROM EPISODES WHERE ID = ?").run(ep.ID);
      });
      this.prepare("SELECT ID, FOLDER_PATH FROM SEASONS").all().forEach(s => {
        if (s.FOLDER_PATH && !fs.existsSync(s.FOLDER_PATH)) this.prepare("DELETE FROM SEASONS WHERE ID = ?").run(s.ID);
      });
      this.prepare("SELECT ID, FOLDER_PATH FROM SERIES").all().forEach(ser => {
        if (ser.FOLDER_PATH && !fs.existsSync(ser.FOLDER_PATH)) this.prepare("DELETE FROM SERIES WHERE ID = ?").run(ser.ID);
      });
    });
    syncTransaction();
  }
}

module.exports = new DatabaseManager();