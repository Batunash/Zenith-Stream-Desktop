import { describe, it, expect, vi, beforeEach } from 'vitest';

const mediaMocks = vi.hoisted(() => ({
  getSeries: vi.fn(),
  getEpisodesBySeries: vi.fn(),
  initializeDatabase: vi.fn(),
}));

vi.mock('../services/mediaService', () => ({ ...mediaMocks }));

// Manual require.cache injection for CJS interop on Windows
const _p = require('path');
const _mediaSvcPath = _p.resolve(process.cwd(), 'backend/src/services/mediaService.js');

require.cache[_mediaSvcPath] = {
  id: _mediaSvcPath,
  filename: _mediaSvcPath,
  loaded: true,
  exports: mediaMocks,
  children: [],
  paths: [],
};

const { listSeries, getSeriesEpisodes } = require('./mediaController');

describe('Media Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost:5000'),
      user: { id: 1 },
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe('listSeries', () => {
    it('returns series list with base url', async () => {
      const mockSeries = [{ id: 1, title: 'Test' }];
      mediaMocks.getSeries.mockReturnValueOnce(mockSeries);

      await listSeries(mockReq, mockRes);

      expect(mediaMocks.getSeries).toHaveBeenCalledWith(1, 'http://localhost:5000');
      expect(mockRes.json).toHaveBeenCalledWith({ series: mockSeries });
    });

    it('handles missing user safely', async () => {
      delete mockReq.user;
      mediaMocks.getSeries.mockReturnValueOnce([]);
      await listSeries(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith({ series: [] });
    });

    it('handles exceptions gracefully', async () => {
      mediaMocks.getSeries.mockImplementationOnce(() => {
        throw new Error('DB Crash');
      });
      await listSeries(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'SERIES_LIST_FAILED' });
    });
  });

  describe('getSeriesEpisodes', () => {
    it('returns episodes for a series', async () => {
      mockReq.params.seriesId = '123';
      const mockEpisodes = [{ id: 1, name: 'Ep 1' }];
      mediaMocks.getEpisodesBySeries.mockReturnValueOnce(mockEpisodes);

      await getSeriesEpisodes(mockReq, mockRes);

      expect(mediaMocks.getEpisodesBySeries).toHaveBeenCalledWith('123', 1);
      expect(mockRes.json).toHaveBeenCalledWith({ episodes: mockEpisodes });
    });

    it('handles exceptions gracefully', async () => {
      mockReq.params.seriesId = '123';
      mediaMocks.getEpisodesBySeries.mockImplementationOnce(() => {
        throw new Error('Crash');
      });
      await getSeriesEpisodes(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'EPISODES_LIST_FAILED' });
    });
  });
});
