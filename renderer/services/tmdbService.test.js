import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSeriesByImdb } from './tmdbService';
import { formatTmdbData } from '../utils/formatters';

vi.mock('../utils/formatters', () => ({
  formatTmdbData: vi.fn((data) => ({ ...data, formatted: true })),
}));

describe('TMDB Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches series by IMDB successfully', async () => {
    const mockData = { id: 123, title: 'Test Show' };

    window.api.invoke.mockResolvedValueOnce({
      success: true,
      data: mockData,
      mediaType: 'tv',
    });

    const result = await fetchSeriesByImdb('tt1234567');
    expect(window.api.invoke).toHaveBeenCalledWith(
      'file:fetchMetadata',
      expect.objectContaining({
        imdbId: 'tt1234567',
      })
    );

    expect(formatTmdbData).toHaveBeenCalledWith(mockData, 'tt1234567');
    expect(result.type).toBe('tv');
    expect(result.formatted).toBe(true);
  });

  it('throws error if API call fails', async () => {
    window.api.invoke.mockResolvedValueOnce({
      success: false,
      message: 'Not found',
    });

    await expect(fetchSeriesByImdb('tt9999999')).rejects.toThrow('Not found');
  });

  it('throws default error if API call fails without message', async () => {
    window.api.invoke.mockResolvedValueOnce({
      success: false,
    });

    await expect(fetchSeriesByImdb('tt9999999')).rejects.toThrow('TMDB verisi alınamadı');
  });
});
