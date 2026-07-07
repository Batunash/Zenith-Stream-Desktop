import { describe, it, expect } from 'vitest';
import { extractImdbId, formatTmdbData } from './formatters';

// Defensive note: these tests document the ACTUAL source behavior, including
// quirks. extractImdbId() has no null guard (null/undefined throw) and uses a
// case-sensitive /tt\d+/ regex (lowercase only), so 'TT...' does NOT match.
describe('Formatters', () => {
  describe('extractImdbId()', () => {
    it('extracts an IMDB ID from a full IMDB URL', () => {
      expect(extractImdbId('https://www.imdb.com/title/tt1234567/')).toBe('tt1234567');
    });

    it('extracts an IMDB ID from a short IMDB URL', () => {
      expect(extractImdbId('https://imdb.to/tt1234567')).toBe('tt1234567');
    });

    it('extracts an IMDB ID from a URL with query params', () => {
      expect(extractImdbId('https://www.imdb.com/title/tt1234567/?ref_=ttl')).toBe('tt1234567');
    });

    it('returns null for a non-IMDB URL', () => {
      expect(extractImdbId('https://example.com')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(extractImdbId('')).toBeNull();
    });

    it('throws on null/undefined input (no null guard in source)', () => {
      expect(() => extractImdbId(null)).toThrow(TypeError);
      expect(() => extractImdbId(undefined)).toThrow(TypeError);
    });

    it('handles the tt prefix case-sensitively (lowercase "tt" only)', () => {
      expect(extractImdbId('tt1234567')).toBe('tt1234567');
      // Uppercase 'TT' does NOT match the /tt\d+/ regex — the source is case-sensitive.
      expect(extractImdbId('TT1234567')).toBeNull();
    });

    it('extracts the first IMDB ID when multiple are present', () => {
      expect(extractImdbId('tt1111111 and tt2222222')).toBe('tt1111111');
    });

    it('returns null when there is no digit sequence after tt', () => {
      expect(extractImdbId('tt')).toBeNull();
    });
  });

  describe('formatTmdbData()', () => {
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

    it('formats TMDB series data correctly', () => {
      const apiResult = {
        id: 12345,
        name: 'Test Series',
        overview: 'Test overview',
        vote_average: 8.5,
        number_of_seasons: 3,
        number_of_episodes: 36,
        status: 'Running',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
      };

      expect(formatTmdbData(apiResult, 'tt1234567')).toEqual({
        id: 12345,
        imdb_id: 'tt1234567',
        title: 'Test Series',
        overview: 'Test overview',
        rating: '8.5',
        numberOfSeasons: 3,
        numberOfEpisodes: 36,
        status: 'Running',
        image: `${IMAGE_BASE_URL}/poster.jpg`,
        backdrop: `${IMAGE_BASE_URL}/backdrop.jpg`,
      });
    });

    it('uses title for movies instead of name', () => {
      const apiResult = {
        id: 12345,
        title: 'Test Movie',
        poster_path: '/poster.jpg',
        backdrop_path: null,
      };

      const result = formatTmdbData(apiResult, 'tt1234567');
      expect(result.title).toBe('Test Movie');
      expect(result.backdrop).toBeNull();
    });

    it('falls back to a placeholder image when poster_path is missing', () => {
      const apiResult = { id: 12345, name: 'Test', poster_path: null };
      const result = formatTmdbData(apiResult, 'tt1234567');
      expect(result.image).toBe('https://via.placeholder.com/500x750?text=Gorsel+Yok');
    });

    it('returns null backdrop when backdrop_path is missing', () => {
      const apiResult = { id: 12345, name: 'Test', backdrop_path: null };
      const result = formatTmdbData(apiResult, 'tt1234567');
      expect(result.backdrop).toBeNull();
    });

    it('rounds vote_average to one decimal', () => {
      const apiResult = {
        id: 12345,
        name: 'Test',
        vote_average: 8.7654321,
        poster_path: '/poster.jpg',
      };
      expect(formatTmdbData(apiResult, 'tt1234567').rating).toBe('8.8');
    });

    it('defaults rating to 0.0 when vote_average is missing', () => {
      const apiResult = { id: 12345, name: 'Test', poster_path: '/poster.jpg' };
      expect(formatTmdbData(apiResult, 'tt1234567').rating).toBe('0.0');
    });

    it('defaults rating to 0.0 when vote_average is 0 (falsy)', () => {
      const apiResult = { id: 12345, name: 'Test', vote_average: 0, poster_path: '/poster.jpg' };
      expect(formatTmdbData(apiResult, 'tt1234567').rating).toBe('0.0');
    });

    it('defaults numberOfSeasons to 1 when missing', () => {
      const apiResult = { id: 12345, name: 'Test', poster_path: '/poster.jpg' };
      expect(formatTmdbData(apiResult, 'tt1234567').numberOfSeasons).toBe(1);
    });

    it('defaults numberOfEpisodes to 0 when missing', () => {
      const apiResult = { id: 12345, name: 'Test', poster_path: '/poster.jpg' };
      expect(formatTmdbData(apiResult, 'tt1234567').numberOfEpisodes).toBe(0);
    });

    it('passes through id and imdb_id unchanged', () => {
      const apiResult = { id: 999, name: 'Test', poster_path: '/p.jpg' };
      const result = formatTmdbData(apiResult, 'tt9999999');
      expect(result.id).toBe(999);
      expect(result.imdb_id).toBe('tt9999999');
    });

    it('passes through overview and status fields', () => {
      const apiResult = {
        id: 1,
        name: 'T',
        overview: 'An overview',
        status: 'Ended',
        poster_path: '/p.jpg',
      };
      const result = formatTmdbData(apiResult, 'tt1');
      expect(result.overview).toBe('An overview');
      expect(result.status).toBe('Ended');
    });
  });
});
