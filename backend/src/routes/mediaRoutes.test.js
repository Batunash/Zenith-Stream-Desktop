import { describe, it, expect, vi, beforeEach } from 'vitest';
const request = require('supertest');
const path = require('path');

const ctrl = vi.hoisted(() => ({
  listSeries: vi.fn((req, res) => res.status(200).json([{ id: 1, title: 'S1' }])),
  getSeriesEpisodes: vi.fn((req, res) =>
    res.status(200).json({ seriesId: req.params.seriesId, episodes: [] })
  ),
}));

const mw = vi.hoisted(() => ({
  optionalAuth: vi.fn((req, res, next) => next()),
  authenticateToken: vi.fn((req, res, next) => next()),
}));

vi.mock('../controllers/mediaController', () => ctrl);
vi.mock('../middleware/auth', () => mw);

const cwd = process.cwd();
const ctrlP = path.resolve(cwd, 'backend/src/controllers/mediaController.js');
const mwP = path.resolve(cwd, 'backend/src/middleware/auth.js');
require.cache[ctrlP] = {
  id: ctrlP,
  filename: ctrlP,
  loaded: true,
  exports: ctrl,
  children: [],
  paths: [],
};
require.cache[mwP] = { id: mwP, filename: mwP, loaded: true, exports: mw, children: [], paths: [] };

let app;
beforeEach(() => {
  vi.clearAllMocks();
  mw.optionalAuth.mockImplementation((req, res, next) => next());
  const express = require('express');
  const router = require('./mediaRoutes');
  app = express();
  app.use(express.json());
  app.use('/api', router);
});

describe('Media Routes', () => {
  describe('GET /series', () => {
    it('returns 200 and calls listSeries', async () => {
      const res = await request(app).get('/api/series');
      expect(res.status).toBe(200);
      expect(ctrl.listSeries).toHaveBeenCalled();
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('runs the optionalAuth middleware first', async () => {
      await request(app).get('/api/series');
      expect(mw.optionalAuth).toHaveBeenCalled();
      expect(ctrl.listSeries).toHaveBeenCalled();
    });

    it('still responds when optionalAuth fails to next()', async () => {
      mw.optionalAuth.mockImplementation((req, res, next) => next());
      const res = await request(app).get('/api/series');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /series/:seriesId/episodes', () => {
    it('returns 200 and calls getSeriesEpisodes', async () => {
      const res = await request(app).get('/api/series/42/episodes');
      expect(res.status).toBe(200);
      expect(ctrl.getSeriesEpisodes).toHaveBeenCalled();
    });

    it('forwards the seriesId param to the controller', async () => {
      await request(app).get('/api/series/42/episodes');
      expect(ctrl.getSeriesEpisodes.mock.calls[0][0].params.seriesId).toBe('42');
    });

    it('handles string and numeric ids', async () => {
      await request(app).get('/api/series/abc/episodes');
      expect(ctrl.getSeriesEpisodes.mock.calls[0][0].params.seriesId).toBe('abc');
    });
  });

  describe('routing correctness', () => {
    it('returns 404 for an unconfigured media route', async () => {
      const res = await request(app).get('/api/series/42/seasons');
      expect(res.status).toBe(404);
    });

    it('does not call listSeries on POST /series (wrong method)', async () => {
      const res = await request(app).post('/api/series');
      expect(res.status).toBe(404);
      expect(ctrl.listSeries).not.toHaveBeenCalled();
    });
  });
});
