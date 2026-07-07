import { describe, it, expect, vi, beforeEach } from 'vitest';
const request = require('supertest');
const path = require('path');

const ctrl = vi.hoisted(() => ({
  register:   vi.fn((req, res) => res.status(201).json({ registered: true, body: req.body })),
  login:      vi.fn((req, res) => res.status(200).json({ token: 'jwt-stub', body: req.body })),
  getProfile: vi.fn((req, res) => res.status(200).json({ profile: true, user: req.user }))
}));

const mw = vi.hoisted(() => ({
  authenticateToken: vi.fn((req, res, next) => { req.user = { id: 7 }; next(); })
}));

vi.mock('../controllers/authController', () => ctrl);
vi.mock('../middleware/auth', () => mw);

const cwd = process.cwd();
const ctrlP = path.resolve(cwd, 'backend/src/controllers/authController.js');
const mwP = path.resolve(cwd, 'backend/src/middleware/auth.js');
require.cache[ctrlP] = { id: ctrlP, filename: ctrlP, loaded: true, exports: ctrl, children: [], paths: [] };
require.cache[mwP] = { id: mwP, filename: mwP, loaded: true, exports: mw, children: [], paths: [] };

let app;
beforeEach(() => {
  vi.clearAllMocks();
  mw.authenticateToken.mockImplementation((req, res, next) => { req.user = { id: 7 }; next(); });
  const express = require('express');
  const router = require('./authRoutes');
  app = express();
  app.use(express.json());
  app.use('/api/auth', router);
});

describe('Auth Routes', () => {
  describe('POST /register', () => {
    it('returns 201 and calls the register controller', async () => {
      const res = await request(app).post('/api/auth/register').send({ user: 'batu' });
      expect(res.status).toBe(201);
      expect(ctrl.register).toHaveBeenCalled();
      expect(res.body.registered).toBe(true);
    });

    it('forwards the parsed JSON body to the controller', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
      expect(res.body.body).toEqual({ email: 'a@b.com' });
    });
  });

  describe('POST /login', () => {
    it('returns 200 and calls the login controller', async () => {
      const res = await request(app).post('/api/auth/login').send({ user: 'batu', pass: 'x' });
      expect(res.status).toBe(200);
      expect(ctrl.login).toHaveBeenCalled();
      expect(res.body.token).toBe('jwt-stub');
    });
  });

  describe('GET /profile', () => {
    it('runs authenticateToken then getProfile and returns 200', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(200);
      expect(mw.authenticateToken).toHaveBeenCalled();
      expect(ctrl.getProfile).toHaveBeenCalled();
      expect(res.body.user).toEqual({ id: 7 });
    });

    it('short-circuits to 401 when authenticateToken rejects', async () => {
      mw.authenticateToken.mockImplementation((req, res) => res.status(401).json({ error: 'unauthorized' }));
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(401);
      expect(ctrl.getProfile).not.toHaveBeenCalled();
    });
  });

  describe('routing correctness', () => {
    it('does not call login on a GET /login (method not allowed)', async () => {
      const res = await request(app).get('/api/auth/login');
      expect(res.status).toBe(404);
      expect(ctrl.login).not.toHaveBeenCalled();
    });

    it('registers exactly the three auth endpoints', async () => {
      // verify each handler is wired by exercising them once
      await request(app).post('/api/auth/register').send({});
      await request(app).post('/api/auth/login').send({});
      await request(app).get('/api/auth/profile');
      expect(ctrl.register).toHaveBeenCalledTimes(1);
      expect(ctrl.login).toHaveBeenCalledTimes(1);
      expect(ctrl.getProfile).toHaveBeenCalledTimes(1);
    });
  });
});