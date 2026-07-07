import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// database.js uses:
//   require('sql.js')   → Module.prototype.require intercept → global.__sqlJsMock.initSqlJs
//   require('fs')       → Module.prototype.require intercept → global.__fsMock
//   require('electron') → Module.prototype.require intercept → mock electron
//
// We configure global.__sqlJsMock and global.__fsMock, then vi.resetModules() +
// require('./database') to get a fresh instance wired to our mocks.

describe('DatabaseManager', () => {
  let dbManager;
  let mockDbInstance;
  let fs;

  beforeEach(async () => {
    vi.clearAllMocks();
    fs = global.__fsMock;

    // Build a fresh mock db instance for this test
    mockDbInstance = {
      export:  vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      prepare: vi.fn(),
      run:     vi.fn(),
      exec:    vi.fn().mockReturnValue([{ values: [[1]] }])
    };

    // Configure sql.js mock: initSqlJs() resolves to { Database: constructor }
    // Must use a regular function (not arrow) because database.js calls `new this.SQL.Database()`
    global.__sqlJsMock.initSqlJs.mockResolvedValue({
      Database: function MockDatabase() { return mockDbInstance; }
    });

    // By default, no database file exists → will create new empty db
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockReturnValue(Buffer.from('mock'));

    // Fresh load of database.js so each test gets its own instance
    delete require.cache[require.resolve('./database')];
    dbManager = require('./database');
    await dbManager.initPromise;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('creates a new db if file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      delete require.cache[require.resolve('./database')];
      const m = require('./database');
      await m.initPromise;
      expect(global.__sqlJsMock.initSqlJs).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('loads existing db if file exists', async () => {
      fs.existsSync.mockReturnValue(true);
      delete require.cache[require.resolve('./database')];
      const m = require('./database');
      await m.initPromise;
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('Query Execution (prepare)', () => {
    it('handles warn if db not ready', () => {
      delete require.cache[require.resolve('./database')];
      const m = require('./database');
      m.db = null;
      const stmt = m.prepare('SELECT * FROM USERS');
      stmt.run(); stmt.get(); stmt.all(); // Should not crash
    });

    it('wraps prepare statements correctly', () => {
      const mockStmt = {
        bind:        vi.fn(),
        step:        vi.fn().mockReturnValue(true),
        getAsObject: vi.fn().mockReturnValue({ id: 1 }),
        free:        vi.fn()
      };
      mockDbInstance.prepare.mockReturnValue(mockStmt);

      const stmt = dbManager.prepare('SELECT * FROM USERS');

      const resultGet = stmt.get();
      expect(resultGet).toEqual({ id: 1 });

      mockStmt.step.mockReturnValueOnce(true).mockReturnValueOnce(false);
      const resultAll = stmt.all();
      expect(resultAll).toEqual([{ id: 1 }]);

      stmt.run();
      expect(mockDbInstance.exec).toHaveBeenCalledWith('SELECT last_insert_rowid()');
    });

    it('returns null if get step is false', () => {
      const mockStmt = { bind: vi.fn(), step: vi.fn().mockReturnValue(false), free: vi.fn() };
      mockDbInstance.prepare.mockReturnValue(mockStmt);
      expect(dbManager.prepare('SELECT').get()).toBeNull();
    });
  });

  describe('User Operations', () => {
    it('createUser and getters', () => {
      dbManager.prepare = vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn().mockReturnValue({ ID: 1, USERNAME: 'test' })
      });
      dbManager.createUser('test', 'pw');
      expect(dbManager.getUserByUsername('test')).toEqual({ ID: 1, USERNAME: 'test' });
      expect(dbManager.getUserById(1)).toEqual({ ID: 1, USERNAME: 'test' });
    });
  });

  describe('Media Fetching', () => {
    it('getSeriesWithUserProgress wraps correctly', () => {
      const mockStmt = { all: vi.fn().mockReturnValue([{ ID: 1 }]) };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      expect(dbManager.getSeriesWithUserProgress(1)).toEqual([{ ID: 1 }]);
    });

    it('getSeasonsWithEpisodes processes watch history correctly', () => {
      const mockStmt = { all: vi.fn(), get: vi.fn() };
      mockStmt.all.mockReturnValueOnce([{ ID: 10, SEASON_NUMBER: 1 }]);
      mockStmt.all.mockReturnValueOnce([{ ID: 100, NAME: 'ep1' }]);
      mockStmt.get.mockReturnValueOnce({ PROGRESS: 0.95, WATCH_TIME: 1000 });

      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      const seasons = dbManager.getSeasonsWithEpisodes(1, 1);
      expect(seasons[0].episodes[0].watched).toBe(true);
      expect(seasons[0].episodes[0].progress).toBe(0.95);
    });

    it('getSeasonsWithEpisodes without userId', () => {
      const mockStmt = { all: vi.fn() };
      mockStmt.all.mockReturnValueOnce([{ ID: 10, SEASON_NUMBER: 1 }]);
      mockStmt.all.mockReturnValueOnce([{ ID: 100, NAME: 'ep1' }]);

      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      const seasons = dbManager.getSeasonsWithEpisodes(1);
      expect(seasons[0].episodes[0].progress).toBeUndefined();
    });

    it('getSeasonsWithEpisodes without seasons', () => {
      const mockStmt = { all: vi.fn() };
      mockStmt.all.mockReturnValueOnce([]);

      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      const seasons = dbManager.getSeasonsWithEpisodes(1);
      expect(seasons).toEqual([]);
    });

    it('getEpisodesBySeries gets episodes across all seasons', () => {
      const mockStmt = { all: vi.fn(), get: vi.fn() };
      mockStmt.all.mockReturnValueOnce([{ ID: 10, SEASON_NUMBER: 1 }]);
      mockStmt.all.mockReturnValueOnce([{ ID: 100, NAME: 'ep1', EPISODE_NUMBER: 1 }]);
      mockStmt.get.mockReturnValueOnce({ TITLE: 'My Serie' });

      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      const episodes = dbManager.getEpisodesBySeries(1);
      expect(episodes).toHaveLength(1);
      expect(episodes[0].SERIE_NAME).toBe('My Serie');
    });

    it('getEpisodeBySeriesAndFile handles not founds', () => {
      const mockStmt = { get: vi.fn(), all: vi.fn() };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      mockStmt.get.mockReturnValueOnce(null);
      expect(dbManager.getEpisodeBySeriesAndFile('Invalid', 'file.mkv')).toBeNull();

      mockStmt.get.mockReturnValueOnce({ ID: 1 });
      mockStmt.all.mockReturnValueOnce([]);
      expect(dbManager.getEpisodeBySeriesAndFile('Valid', 'file.mkv')).toBeNull();
    });

    it('getEpisodeBySeriesAndFile returns episode', () => {
      const mockStmt = { get: vi.fn(), all: vi.fn() };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      mockStmt.get.mockReturnValueOnce({ ID: 1 });        // serie
      mockStmt.all.mockReturnValueOnce([{ ID: 10 }]);     // seasons
      mockStmt.get.mockReturnValueOnce({ ID: 100, NAME: 'file.mkv' }); // episode

      expect(dbManager.getEpisodeBySeriesAndFile('Valid', 'file.mkv')).toBeDefined();
    });
  });

  describe('Deletions', () => {
    it('deleteSeriesByPath works', () => {
      const mockStmt = {
        get: vi.fn().mockReturnValue({ ID: 1 }),
        all: vi.fn().mockReturnValue([{ ID: 10 }]),
        run: vi.fn()
      };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      dbManager.deleteSeriesByPath('/path');
      expect(mockStmt.run).toHaveBeenCalledTimes(3); // delete eps, seasons, serie
    });

    it('deleteSeasonByPath works', () => {
      const mockStmt = { get: vi.fn().mockReturnValue({ ID: 10 }), run: vi.fn() };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      dbManager.deleteSeasonByPath('/path');
      expect(mockStmt.run).toHaveBeenCalledTimes(2);
    });

    it('deleteEpisodeByPath works', () => {
      const mockStmt = { run: vi.fn() };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      dbManager.deleteEpisodeByPath('/path');
      expect(mockStmt.run).toHaveBeenCalled();
    });
  });

  describe('Watch Progress', () => {
    it('updateWatchProgress updates', () => {
      const mockStmt = { run: vi.fn() };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      dbManager.updateWatchProgress(1, 1, 0.5, 500);
      expect(mockStmt.run).toHaveBeenCalledWith(1, 1, 0.5, 500);
    });

    it('getUserEpisodeProgress gets', () => {
      const mockStmt = { get: vi.fn().mockReturnValue({ PROGRESS: 0.5 }) };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      expect(dbManager.getUserEpisodeProgress(1, 1)).toEqual({ PROGRESS: 0.5 });
    });

    it('getEpisodeById gets', () => {
      const mockStmt = { get: vi.fn().mockReturnValue({ ID: 1 }) };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      expect(dbManager.getEpisodeById(1)).toEqual({ ID: 1 });
    });
  });

  describe('Sync Filesystem', () => {
    it('handles empty media dir correctly', () => {
      fs.existsSync.mockReturnValue(false);
      dbManager.syncFilesystemToDatabase('/invalid', ['.mkv']);
      expect(fs.readdirSync).not.toHaveBeenCalled();
    });

    it('syncs movies correctly', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir, options) => {
        if (dir === '/media') return [{ name: 'My Movie', isDirectory: () => true, isFile: () => false }];
        if (dir.includes('My Movie')) return [{ name: 'movie.mkv', isDirectory: () => false, isFile: () => true }];
        return [];
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({ type: 'movie' }));
      fs.statSync.mockReturnValue({ size: 100 });

      const mockStmt = {
        get: vi.fn().mockImplementation((...args) => {
             // force exists to be null on first run to hit INSERT
             return null;
        }),
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
        all: vi.fn().mockReturnValue([])
      };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      dbManager.syncFilesystemToDatabase('/media', ['.mkv']);
      
      // Call again but make things exist to hit UPDATE
      mockStmt.get.mockReturnValue({ ID: 1 });
      dbManager.syncFilesystemToDatabase('/media', ['.mkv']);
      
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('syncs series with seasons correctly', () => {
      const mediaDir = '/media';
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir, options) => {
        if (dir === mediaDir) return [{ name: 'SerieA', isDirectory: () => true }];
        if (dir.includes('Season 1')) {
          if (options && options.withFileTypes) return [];
          return ['episode1.mkv'];
        }
        if (dir.includes('SerieA')) return [{ name: 'Season 1', isDirectory: () => true }];
        return [];
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({
        title: 'Serie A', type: 'serie', localPoster: 'p.jpg', backdrop: 'b.jpg', overview: 'desc', rating: 9.0, id: 123
      }));
      fs.statSync.mockReturnValue({ size: 1000 });

      const mockStmt = {
        all: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(null),
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 })
      };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      dbManager.syncFilesystemToDatabase('/media', ['.mkv']);

      // Now hit UPDATE branches
      mockStmt.run.mockReturnValueOnce({ lastInsertRowid: 100 });
      mockStmt.run.mockReturnValueOnce({ lastInsertRowid: 1000 });

      dbManager.syncFilesystemToDatabase('/media', ['.mkv']);

      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('syncDatabase handles metadata parsing missing fields', () => {
      const mediaDir = 'C:\\Media';
      fs.existsSync.mockReturnValue(true);
      
      // Return a directory that has metadata, but missing optional fields
      fs.readdirSync.mockImplementation((dir) => {
        if (dir === mediaDir) return [{ name: 'TestSerie', isDirectory: () => true }];
        if (dir.includes('TestSerie')) return [];
        return [];
      });

      fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('metadata.json')) return JSON.stringify({
           // Missing title, type, rating, id etc to trigger fallback branches
        });
        return '';
      });

      const mockStmt = {
        all: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(null),
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 })
      };
      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);

      dbManager.syncFilesystemToDatabase('C:\\Media', ['.mkv']);

      expect(mockStmt.run).toHaveBeenCalled();
      const insertArgs = mockStmt.run.mock.calls[0];
      expect(insertArgs).toContain('TestSerie'); // Falls back to dir name
    });

    it('deletes missing records', () => {
      const mockStmt = { all: vi.fn(), run: vi.fn() };
      mockStmt.all.mockReturnValue([{ ID: 1, FOLDER_PATH: '/missing', FILE_PATH: '/missing/file.mkv' }]);
      fs.existsSync.mockImplementation(p => p === '/media');
      fs.readdirSync.mockReturnValue([]);

      dbManager.prepare = vi.fn().mockReturnValue(mockStmt);
      dbManager.syncFilesystemToDatabase('/media', ['.mkv']);

      expect(mockStmt.run).toHaveBeenCalled();
    });
  });
});
