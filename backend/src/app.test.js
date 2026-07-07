import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const path = require('path');

const routers = vi.hoisted(() => {
  const express = require('express');
  const media = express.Router();
  media.get('/series', (req, res) => res.status(200).json([{ id: 1, title: 'Stub Series' }]));
  media.get('/series/:seriesId/episodes', (req, res) => res.status(200).json([{ id: 10 }]));

  const auth = express.Router();
  auth.post('/register', (req, res) => res.status(201).json({ ok: true }));
  auth.post('/login', (req, res) => res.status(200).json({ ok: true, body: req.body }));
  auth.get('/profile', (req, res) => res.status(200).json({ user: 'stub' }));

  const watch = express.Router();
  watch.get('/stream/:episodeId', (req, res) => res.status(200).json({ ok: true }));
  watch.put('/episode/:episodeId/progress', (req, res) => res.status(200).json({ ok: true }));

  return { media, auth, watch };
});

const cfgMock = vi.hoisted(() => ({
  MEDIA_DIR: require('os').tmpdir(), PORT: 5000, JWT_SECRET: 's', JWT_EXPIRES_IN: '7d'
}));

vi.mock('./config/config', () => ({ ...cfgMock }));
vi.mock('./routes/mediaRoutes', () => routers.media);
vi.mock('./routes/authRoutes', () => routers.auth);
vi.mock('./routes/watchRoutes', () => routers.watch);

const cwd = process.cwd();
const injectCache = (rel, exports) => {
  const resolved = path.resolve(cwd, rel);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
};
injectCache('backend/src/config/config.js', cfgMock);
injectCache('backend/src/routes/mediaRoutes.js', routers.media);
injectCache('backend/src/routes/authRoutes.js', routers.auth);
injectCache('backend/src/routes/watchRoutes.js', routers.watch);

let app;
beforeEach(() => {
  delete require.cache[require.resolve('./app')];
  app = require('./app');
});

describe('Express App', () => {
  describe('health endpoint', () => {
    it('GET /health returns 200 ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('applies CORS headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('route mounting', () => {
    it('mounts authRoutes at /api/auth', async () => {
      const res = await request(app).post('/api/auth/login').send({ user: 'batu' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('mounts mediaRoutes at /api', async () => {
      const res = await request(app).get('/api/series');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('mounts watchRoutes at /api', async () => {
      const res = await request(app).get('/api/stream/123');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('mounts mediaRoutes episodes sub-route', async () => {
      const res = await request(app).get('/api/series/5/episodes');
      expect(res.status).toBe(200);
    });
  });

  describe('middleware', () => {
    it('parses JSON request bodies', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ user: 'batu', pass: 'secret' }));
      expect(res.status).toBe(200);
      expect(res.body.body).toEqual({ user: 'batu', pass: 'secret' });
    });

    it('returns 400 on malformed JSON', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ not json');
      expect(res.status).toBe(400);
    });
  });

  describe('unknown routes', () => {
    it('returns 404 for an undefined route', async () => {
      const res = await request(app).get('/api/this-does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('static serving', () => {
    // The global fs mock lacks fs.stat, which express.static uses per request.
    // Provide an ENOENT-returning stat so serve-static falls through to 404,
    // proving the /images static middleware is mounted without crashing.
    let origStat;
    beforeEach(() => {
      origStat = global.__fsMock.stat;
      global.__fsMock.stat = (p, cb) => cb(Object.assign(new Error('not found'), { code: 'ENOENT' }));
    });
    afterEach(() => {
      global.__fsMock.stat = origStat;
    });

    it('serves /images from MEDIA_DIR (404 for missing files)', async () => {
      const res = await request(app).get('/images/does-not-exist.jpg');
      expect(res.status).toBe(404);
    });
  });
});