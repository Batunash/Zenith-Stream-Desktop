import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSeries, getEpisodesBySeries, initializeDatabase } from './mediaService';

const db = require('../config/database');
const config = require('../config/config');

describe('Media Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(db, 'getSeriesWithUserProgress');
    vi.spyOn(db, 'getAllSeries');
    vi.spyOn(db, 'getSeasonsWithEpisodes');
    vi.spyOn(db, 'getEpisodesBySeries');
    vi.spyOn(db, 'syncFilesystemToDatabase').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeDatabase', () => {
    it('should sync filesystem to DB successfully', () => {
      config.MEDIA_DIR = '/test/media';
      initializeDatabase();
      expect(db.syncFilesystemToDatabase).toHaveBeenCalledWith('/test/media', expect.any(Array));
      expect(console.log).toHaveBeenCalledWith('Database sync OK. Media Dir:', '/test/media');
    });

    it('should catch and log errors', () => {
      db.syncFilesystemToDatabase.mockImplementation(() => {
        throw new Error('Sync Failed');
      });
      initializeDatabase();
      expect(console.error).toHaveBeenCalledWith('Sync Error:', expect.any(Error));
    });
  });

  describe('getSeries', () => {
    it('should fetch all series and format correctly without user', () => {
      db.getAllSeries.mockReturnValue([
        {
          ID: 1,
          TITLE: 'Test',
          POSTER_PATH: '/poster.jpg',
          BACKDROP_PATH: 'http://example.com/bg.jpg',
          RATING: 5,
          OVERVIEW: 'Overview',
        },
      ]);
      db.getSeasonsWithEpisodes.mockReturnValue([
        {
          ID: 10,
          NAME: 'Season 1',
          SEASON_NUMBER: 1,
          episodes: [
            {
              ID: 100,
              NAME: 'Ep 1',
              EPISODE_NUMBER: 1,
              DURATION: 120,
            },
          ],
        },
      ]);

      const result = getSeries(null, 'http://localhost');

      expect(db.getAllSeries).toHaveBeenCalled();
      expect(db.getSeriesWithUserProgress).not.toHaveBeenCalled();
      expect(db.getSeasonsWithEpisodes).toHaveBeenCalledWith(1, null);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].poster).toBe('http://localhost/poster.jpg');
      expect(result[0].backdrop).toBe('http://example.com/bg.jpg'); // Absolute URL stays absolute
      expect(result[0].seasons[0].episodes[0].duration).toBe('2m');
    });

    it('should handle absolute POSTER_PATH and relative BACKDROP_PATH', () => {
      db.getAllSeries.mockReturnValue([
        {
          ID: 2,
          TITLE: 'Test2',
          POSTER_PATH: 'http://poster.jpg',
          BACKDROP_PATH: '/bg.jpg',
          RATING: 5,
          OVERVIEW: 'Overview',
        },
      ]);
      db.getSeasonsWithEpisodes.mockReturnValue([]);

      const result = getSeries(null, 'http://localhost');

      expect(result[0].poster).toBe('http://poster.jpg');
      expect(result[0].backdrop).toBe('http://localhost/bg.jpg');
    });

    it('should handle missing paths', () => {
      db.getAllSeries.mockReturnValue([
        {
          ID: 3,
          TITLE: 'Test3',
          RATING: 5,
          OVERVIEW: 'Overview',
        },
      ]);
      db.getSeasonsWithEpisodes.mockReturnValue([]);

      const result = getSeries(null, 'http://localhost');

      expect(result[0].poster).toBeNull();
      expect(result[0].backdrop).toBeNull();
    });

    it('should fetch series with user progress and format correctly', () => {
      db.getSeriesWithUserProgress.mockReturnValue([
        {
          ID: 1,
          TITLE: 'Test',
          POSTER_PATH: '/poster.jpg',
          RATING: 5,
        },
      ]);
      db.getSeasonsWithEpisodes.mockReturnValue([
        {
          ID: 10,
          NAME: 'Season 1',
          SEASON_NUMBER: 1,
          episodes: [
            {
              ID: 100,
              NAME: 'Ep 1',
              EPISODE_NUMBER: 1,
              DURATION: 0,
              watched: true,
              progress: 0.5,
              watchTime: 60,
            },
          ],
        },
      ]);

      const result = getSeries(5, 'http://localhost');

      expect(db.getSeriesWithUserProgress).toHaveBeenCalledWith(5);
      expect(db.getSeasonsWithEpisodes).toHaveBeenCalledWith(1, 5);

      expect(result[0].seasons[0].episodes[0].watched).toBe(true);
      expect(result[0].seasons[0].episodes[0].duration).toBe('0m');
    });

    it('should throw an error if DB throws', () => {
      db.getAllSeries.mockImplementation(() => {
        throw new Error('DB Crash');
      });
      expect(() => getSeries(null)).toThrow('DB Crash');
    });
  });

  describe('getEpisodesBySeries', () => {
    it('should fetch and return episodes', () => {
      const mockEps = [{ ID: 1, NAME: 'Ep1' }];
      db.getEpisodesBySeries.mockReturnValue(mockEps);

      const result = getEpisodesBySeries(1);
      expect(db.getEpisodesBySeries).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockEps);
    });

    it('should throw if DB throws', () => {
      db.getEpisodesBySeries.mockImplementation(() => {
        throw new Error('DB Error');
      });
      expect(() => getEpisodesBySeries(1)).toThrow('DB Error');
    });
  });

  describe('Defensive Input Handling', () => {
    it('should gracefully handle malicious inputs (SQLi / XSS patterns) without crashing', () => {
      // Test how service formats output even if DB returns malicious strings (Sanitization simulation)
      db.getAllSeries.mockReturnValue([
        {
          ID: 1,
          TITLE: '<script>alert(1)</script>',
          POSTER_PATH: '/poster.jpg',
          BACKDROP_PATH: "' OR 1=1;--",
          RATING: 5,
          OVERVIEW: 'DROP TABLE users;',
        },
      ]);
      db.getSeasonsWithEpisodes.mockReturnValue([
        {
          ID: 10,
          NAME: 'Season 1',
          SEASON_NUMBER: 1,
          episodes: [],
        },
      ]);

      const result = getSeries(null, 'http://localhost');

      // Should just pass strings through as string values without breaking structure
      expect(result[0].title).toBe('<script>alert(1)</script>');
      expect(result[0].backdrop).toBe("http://localhost' OR 1=1;--");
      expect(result[0].description).toBe('DROP TABLE users;');
    });

    it('should handle extreme long integer inputs safely', () => {
      const extremeId = 999999999999999;
      db.getEpisodesBySeries.mockReturnValue([]);
      const result = getEpisodesBySeries(extremeId);
      expect(db.getEpisodesBySeries).toHaveBeenCalledWith(extremeId);
      expect(result).toEqual([]);
    });
  });
});
