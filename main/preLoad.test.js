import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const Module = require('module');

// preLoad.js destructures { contextBridge, ipcRenderer } from electron. The
// global require interceptor in vitest.setup.js does not supply those, so we
// temporarily patch Module.prototype.require to hand preLoad a tailored mock.
const contextBridge = { exposeInMainWorld: vi.fn() };
const ipcRenderer = {
  send: vi.fn(),
  on: vi.fn(),
  invoke: vi.fn().mockResolvedValue('invoked-result'),
  removeAllListeners: vi.fn(),
};
const electronMock = { contextBridge, ipcRenderer };

let originalRequire;
let exposedApi;

beforeEach(() => {
  vi.clearAllMocks();
  originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'electron') return electronMock;
    return originalRequire.apply(this, arguments);
  };
  delete require.cache[require.resolve('./preLoad')];
  require('./preLoad');
  exposedApi = contextBridge.exposeInMainWorld.mock.calls[0][1];
});

afterEach(() => {
  Module.prototype.require = originalRequire;
});

describe('Preload Script', () => {
  describe('contextBridge exposure', () => {
    it('exposes an object named "api" on the main world', () => {
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);
      expect(contextBridge.exposeInMainWorld.mock.calls[0][0]).toBe('api');
      expect(typeof exposedApi).toBe('object');
    });

    it('exposes exactly send, receive, invoke, remove', () => {
      expect(Object.keys(exposedApi).sort()).toEqual(['invoke', 'receive', 'remove', 'send']);
    });
  });

  describe('send()', () => {
    it('forwards to ipcRenderer.send for whitelisted channels', () => {
      exposedApi.send('server:start', { foo: 1 });
      expect(ipcRenderer.send).toHaveBeenCalledWith('server:start', { foo: 1 });
    });

    it('blocks non-whitelisted channels and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      exposedApi.send('evil:channel', 'payload');
      expect(ipcRenderer.send).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('receive()', () => {
    it('registers an ipcRenderer.on listener for whitelisted channels', () => {
      const handler = vi.fn();
      exposedApi.receive('file:addEpisode:done', handler);
      expect(ipcRenderer.on).toHaveBeenCalledWith('file:addEpisode:done', expect.any(Function));
      // The wrapped listener should unpack args and call user handler
      const registeredListener = ipcRenderer.on.mock.calls[0][1];
      registeredListener({}, 'a', 'b');
      expect(handler).toHaveBeenCalledWith('a', 'b');
    });

    it('blocks non-whitelisted channels and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      exposedApi.receive('no:such:channel', vi.fn());
      expect(ipcRenderer.on).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('invoke()', () => {
    it('returns ipcRenderer.invoke result for whitelisted channels', async () => {
      ipcRenderer.invoke.mockResolvedValueOnce('ok-value');
      const result = await exposedApi.invoke('settings:get', { section: 'general' });
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:get', { section: 'general' });
      expect(result).toBe('ok-value');
    });

    it('blocks non-whitelisted channels and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = exposedApi.invoke('forbidden:channel', {});
      expect(ipcRenderer.invoke).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
      warn.mockRestore();
    });
  });

  describe('remove()', () => {
    it('removes all listeners for a channel', () => {
      exposedApi.remove('media:progress');
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('media:progress');
    });
  });

  describe('channel whitelist', () => {
    it('accepts the known valid channels', () => {
      // exercise a representative subset
      [
        'auth:login',
        'server:start',
        'file:createSerie',
        'settings:save',
        'window:close',
        'media:analyze',
        'browser:downloadStream',
      ].forEach((ch) => {
        exposedApi.send(ch, null);
      });
      expect(ipcRenderer.send).toHaveBeenCalledTimes(7);
    });

    it('rejects malformed channels', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      ['', 'random', 'server stop', null, undefined].forEach((ch) => {
        exposedApi.send(ch, null);
      });
      expect(ipcRenderer.send).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
