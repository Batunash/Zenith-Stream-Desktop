import { describe, it, expect, vi, beforeEach } from 'vitest';
const path = require('path');

// Mock the express app and config consumed by backend/index.js. The mock app
// is a plain object with vi.fn() methods so each test can drive listen/close
// semantics (success callback, error event, close error) independently.
const mockApp = vi.hoisted(() => ({ listen: vi.fn(), on: vi.fn(), close: vi.fn() }));
const cfgMock = vi.hoisted(() => ({
  PORT: 3001, MEDIA_DIR: '/tmp/media', JWT_SECRET: 's', JWT_EXPIRES_IN: '7d'
}));

vi.mock('./src/app', () => mockApp);
vi.mock('./src/config/config', () => ({ ...cfgMock }));

const cwd = process.cwd();
const appResolved = path.resolve(cwd, 'backend/src/app.js');
const cfgResolved = path.resolve(cwd, 'backend/src/config/config.js');
require.cache[appResolved] = { id: appResolved, filename: appResolved, loaded: true, exports: mockApp, children: [], paths: [] };
require.cache[cfgResolved] = { id: cfgResolved, filename: cfgResolved, loaded: true, exports: cfgMock, children: [], paths: [] };

let serverManager;
beforeEach(() => {
  mockApp.listen.mockReset();
  mockApp.on.mockReset();
  mockApp.close.mockReset();
  delete require.cache[require.resolve('./index')];
  serverManager = require('./index');
});

// Helper: a server object capturing the 'error' handler so tests can fire it.
const makeErrorServer = () => {
  const s = { on: vi.fn((evt, handler) => { if (evt === 'error') s._err = handler; }) };
  return s;
};

describe('Server Manager', () => {
  describe('start()', () => {
    it('starts and resolves true when listen succeeds', async () => {
      const mockServer = { on: vi.fn() };
      mockApp.listen.mockImplementation((port, host, cb) => { cb(); return mockServer; });

      const result = await serverManager.start();
      expect(result).toBe(true);
      expect(mockApp.listen).toHaveBeenCalledWith(3001, '0.0.0.0', expect.any(Function));
      expect(serverManager.isRunning()).toBe(true);
    });

    it('uses PORT from config as the first listen argument', async () => {
      const mockServer = { on: vi.fn() };
      mockApp.listen.mockImplementation((port, host, cb) => { cb(); return mockServer; });
      await serverManager.start();
      expect(mockApp.listen.mock.calls[0][0]).toBe(3001);
    });

    it('binds to 0.0.0.0', async () => {
      const mockServer = { on: vi.fn() };
      mockApp.listen.mockImplementation((port, host, cb) => { cb(); return mockServer; });
      await serverManager.start();
      expect(mockApp.listen.mock.calls[0][1]).toBe('0.0.0.0');
    });

    it('rejects when the server emits an error event', async () => {
      const mockServer = makeErrorServer();
      mockApp.listen.mockImplementation(() => mockServer); // do not call cb

      const p = serverManager.start();
      mockServer._err(new Error('Port already in use'));
      await expect(p).rejects.toThrow('Port already in use');
    });

    it('rejects on EADDRINUSE-like errors', async () => {
      const mockServer = makeErrorServer();
      mockApp.listen.mockImplementation(() => mockServer);
      const p = serverManager.start();
      mockServer._err(new Error('EADDRINUSE'));
      await expect(p).rejects.toThrow('EADDRINUSE');
    });

    it('resolves true immediately if already running', async () => {
      const mockServer = { on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return mockServer; });
      await serverManager.start();
      const result = await serverManager.start();
      expect(result).toBe(true);
      expect(mockApp.listen).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('resolves false when nothing is running', async () => {
      const result = await serverManager.stop();
      expect(result).toBe(false);
    });

    it('closes the running server and resolves false', async () => {
      const mockServer = { close: vi.fn((cb) => cb && cb()), on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return mockServer; });
      await serverManager.start();

      const result = await serverManager.stop();
      expect(mockServer.close).toHaveBeenCalled();
      expect(result).toBe(false);
      expect(serverManager.isRunning()).toBe(false);
    });

    it('rejects when close errors', async () => {
      const mockServer = { close: vi.fn((cb) => cb(new Error('Cannot close'))), on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return mockServer; });
      await serverManager.start();
      await expect(serverManager.stop()).rejects.toThrow('Cannot close');
    });

    it('nullifies the server reference after stop', async () => {
      const mockServer = { close: vi.fn((cb) => cb()), on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return mockServer; });
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);
      await serverManager.stop();
      expect(serverManager.isRunning()).toBe(false);
    });
  });

  describe('isRunning()', () => {
    it('returns false before start', () => {
      expect(serverManager.isRunning()).toBe(false);
    });

    it('returns true after a successful start', async () => {
      const mockServer = { on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return mockServer; });
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);
    });

    it('returns false after a stop', async () => {
      const mockServer = { close: vi.fn((cb) => cb()), on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return mockServer; });
      await serverManager.start();
      await serverManager.stop();
      expect(serverManager.isRunning()).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('survives a start-stop-start cycle', async () => {
      const s1 = { close: vi.fn((cb) => cb()), on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return s1; });
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);

      await serverManager.stop();
      expect(serverManager.isRunning()).toBe(false);

      const s2 = { on: vi.fn() };
      mockApp.listen.mockImplementation((p, h, cb) => { cb(); return s2; });
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);
    });

    it('propagates error events from the underlying server', async () => {
      const mockServer = makeErrorServer();
      mockApp.listen.mockImplementation(() => mockServer);
      const p = serverManager.start();
      mockServer._err(new Error('boom'));
      await expect(p).rejects.toThrow('boom');
    });
  });
});