import { describe, it, expect, vi, beforeEach } from 'vitest';
const request = require('supertest');
const path = require('path');

const ctrl = vi.hoisted(() => ({
  startWatch: vi.fn((req, res) =>
    res.status(200).json({ watching: true, episodeId: req.params.episodeId })
  ),
  updateProgress: vi.fn((req, res) =>
    res.status(200).json({ saved: true, episodeId: req.params.episodeId, body: req.body })
  ),
  downloadEpisode: vi.fn((req, res) =>
    res.status(200).json({ downloading: true, episodeId: req.params.episodeId })
  ),
}));

const mw = vi.hoisted(() => ({
  optionalAuth: vi.fn((req, res, next) => next()),
  authenticateToken: vi.fn((req, res, next) => next()),
}));

vi.mock('../controllers/watchController', () => ctrl);
vi.mock('../middleware/auth', () => mw);

const cwd = process.cwd();
const ctrlP = path.resolve(cwd, 'backend/src/controllers/watchController.js');
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
  const router = require('./watchRoutes');
  app = express();
  app.use(express.json());
  app.use('/api', router);
});

describe('Watch Routes', () => {
  describe('GET /stream/:episodeId', () => {
    it('returns 200 and calls startWatch', async () => {
      const res = await request(app).get('/api/stream/5');
      expect(res.status).toBe(200);
      expect(ctrl.startWatch).toHaveBeenCalled();
      expect(res.body.watching).toBe(true);
    });

    it('forwards the episodeId param', async () => {
      await request(app).get('/api/stream/77');
      expect(ctrl.startWatch.mock.calls[0][0].params.episodeId).toBe('77');
    });

    it('runs optionalAuth first', async () => {
      await request(app).get('/api/stream/5');
      expect(mw.optionalAuth).toHaveBeenCalled();
    });
  });

  describe('PUT /episode/:episodeId/progress', () => {
    it('returns 200 and calls updateProgress', async () => {
      const res = await request(app).put('/api/episode/9/progress').send({ progress: 0.5 });
      expect(res.status).toBe(200);
      expect(ctrl.updateProgress).toHaveBeenCalled();
    });

    it('forwards the episodeId param and JSON body', async () => {
      await request(app).put('/api/episode/9/progress').send({ progress: 0.75, position: 120 });
      const req = ctrl.updateProgress.mock.calls[0][0];
      expect(req.params.episodeId).toBe('9');
      expect(req.body).toEqual({ progress: 0.75, position: 120 });
    });
  });

  describe('GET /download/:episodeId', () => {
    it('returns 200 and calls downloadEpisode', async () => {
      const res = await request(app).get('/api/download/3');
      expect(res.status).toBe(200);
      expect(ctrl.downloadEpisode).toHaveBeenCalled();
      expect(res.body.downloading).toBe(true);
    });

    it('forwards the episodeId param', async () => {
      await request(app).get('/api/download/11');
      expect(ctrl.downloadEpisode.mock.calls[0][0].params.episodeId).toBe('11');
    });
  });

  describe('routing correctness', () => {
    it('returns 404 for an unknown watch route', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.status).toBe(404);
    });

    it('does not call startWatch on POST (wrong method)', async () => {
      const res = await request(app).post('/api/stream/5');
      expect(res.status).toBe(404);
      expect(ctrl.startWatch).not.toHaveBeenCalled();
    });

    it('wires all three watch endpoints', async () => {
      await request(app).get('/api/stream/1');
      await request(app).put('/api/episode/1/progress').send({});
      await request(app).get('/api/download/1');
      expect(ctrl.startWatch).toHaveBeenCalledTimes(1);
      expect(ctrl.updateProgress).toHaveBeenCalledTimes(1);
      expect(ctrl.downloadEpisode).toHaveBeenCalledTimes(1);
    });
  });
});
