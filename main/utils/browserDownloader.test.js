import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Test-only mock wiring ───────────────────────────────────────────────────
// browserDownloader.js does `const { BrowserWindow, BrowserView, app, net } = require('electron')`
// at load time. vitest.setup.js's Module.prototype.require interceptor returns a minimal
// electron mock that LACKS BrowserView and net, so this file installs (per test) a richer
// electron mock + a ./ffmpegHelper mock (with .save/.kill that the setup's fluent-ffmpeg
// mock lacks) BEFORE requiring browserDownloader.js fresh. Module-level `let` state
// (captureView, capturedStreams, activeDownloads, requestHeadersMap) therefore resets
// per test via vi.resetModules() + delete require.cache.

const Module = require('module');
const setupRequire = Module.prototype.require; // the vitest.setup.js interceptor

function makeWebContents(opts = {}) {
  return {
    isDestroyed: vi.fn(() => false),
    session: {
      setUserAgent: vi.fn(),
      webRequest: {
        onBeforeSendHeaders: vi.fn(),
        onResponseStarted: vi.fn(),
      },
      cookies: { get: vi.fn(() => Promise.resolve([])) },
    },
    loadURL: vi.fn(() => Promise.resolve()),
    getTitle: vi.fn(() => opts.title ?? 'Test Page'),
    getURL: vi.fn(() => opts.url ?? 'https://example.com/page'),
    canGoBack: vi.fn(() => !!opts.canGoBack),
    canGoForward: vi.fn(() => !!opts.canGoForward),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    on: vi.fn(),
  };
}

function makeView(opts) {
  return { webContents: makeWebContents(opts), setBounds: vi.fn() };
}

function setupModules(opts = {}) {
  // ffmpegHelper mock: a function returning a chainable command with .save/.kill.
  const commandMock = {
    inputOptions: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    input: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    save: vi.fn(),
    kill: vi.fn(),
  };
  const ffmpegHelperMock = vi.fn(() => commandMock);

  // Rich electron mock.
  const BrowserView = vi.fn(function () {
    return makeView(opts);
  });
  const mainWindow = {
    setBrowserView: vi.fn(),
    removeBrowserView: vi.fn(),
    webContents: { send: vi.fn() },
  };
  const BrowserWindow = Object.assign(vi.fn(), {
    getAllWindows: vi.fn(() => opts.windows ?? [mainWindow]),
    fromWebContents: vi.fn(),
  });
  const app = { getPath: vi.fn(() => '/mock/downloads'), isPackaged: false };
  const net = { fetch: vi.fn() };
  const richElectron = { app, BrowserWindow, BrowserView, net, ipcMain: { handle: vi.fn() } };

  // Patch require for electron only; delegate everything else to the setup interceptor
  // (so require('fs') keeps hitting the setup mockFs, require('./ffmpegHelper') hits cache, etc).
  Module.prototype.require = function (id) {
    if (id === 'electron') return richElectron;
    return setupRequire.apply(this, arguments);
  };

  // Inject ffmpegHelper mock into Node's cache so browserDownloader's require gets it.
  const ffResolved = require.resolve('./ffmpegHelper');
  delete require.cache[ffResolved];
  require.cache[ffResolved] = {
    id: ffResolved,
    filename: ffResolved,
    loaded: true,
    exports: ffmpegHelperMock,
    children: [],
    paths: [],
  };

  // Fresh browserDownloader module (resets module-level `let` state).
  vi.resetModules();
  delete require.cache[require.resolve('./browserDownloader')];
  const mod = require('./browserDownloader');

  return { mod, commandMock, ffmpegHelperMock, BrowserView, BrowserWindow, mainWindow, net, app };
}

function restoreRequire() {
  Module.prototype.require = setupRequire;
  delete require.cache[require.resolve('./ffmpegHelper')];
  delete require.cache[require.resolve('./browserDownloader')];
}

// Flush micro- and macro-tasks so async executor internals (await net.fetch, await text)
// settle before we grab the captured command.on('end'/'error'/'progress') callbacks.
const flush = (n = 6) => {
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
};

describe('browserDownloader', () => {
  let env;
  beforeEach(() => {
    vi.clearAllMocks();
    env = setupModules();
  });
  afterEach(() => {
    restoreRequire();
  });

  describe('module exports', () => {
    it('exports the full public API', () => {
      expect(Object.keys(env.mod).sort()).toEqual([
        'cancelDownload',
        'clearCapturedStreams',
        'clearCompletedDownloads',
        'downloadStream',
        'getCapturedStreams',
        'getDownloads',
        'goBack',
        'goForward',
        'hideBrowserView',
        'initBrowserView',
        'navigateTo',
        'reload',
        'resizeBrowserView',
        'showBrowserView',
      ]);
    });
  });

  describe('navigateTo', () => {
    it('converts http URLs to https and resolves with {success, url}', async () => {
      const r = await env.mod.navigateTo('http://example.com');
      expect(r).toEqual({ success: true, url: 'https://example.com' });
      const view = env.BrowserView.mock.results[0].value;
      expect(view.webContents.loadURL).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ extraHeaders: expect.any(String) })
      );
    });

    it('passes https URLs through', async () => {
      await env.mod.navigateTo('https://secure.test/path?q=1');
      expect(env.BrowserView.mock.results[0].value.webContents.loadURL.mock.calls[0][0]).toBe(
        'https://secure.test/path?q=1'
      );
    });

    it('prepends https:// to a bare host with a dot and no spaces', async () => {
      await env.mod.navigateTo('example.com');
      expect(env.BrowserView.mock.results[0].value.webContents.loadURL.mock.calls[0][0]).toBe(
        'https://example.com'
      );
    });

    it('treats a space-containing term as a Google search', async () => {
      await env.mod.navigateTo('breaking bad season 1');
      expect(env.BrowserView.mock.results[0].value.webContents.loadURL.mock.calls[0][0]).toBe(
        'https://www.google.com/search?q=' + encodeURIComponent('breaking bad season 1')
      );
    });

    it('treats a dot-less term as a Google search', async () => {
      await env.mod.navigateTo('superman');
      expect(env.BrowserView.mock.results[0].value.webContents.loadURL.mock.calls[0][0]).toBe(
        'https://www.google.com/search?q=superman'
      );
    });
  });

  describe('initBrowserView', () => {
    it('creates a BrowserView and sets a user agent', () => {
      const v = env.mod.initBrowserView();
      expect(env.BrowserView).toHaveBeenCalledTimes(1);
      expect(v).toBeTruthy();
      expect(v.webContents.session.setUserAgent).toHaveBeenCalled();
    });

    it('registers onBeforeSendHeaders and onResponseStarted interceptors with url filter', () => {
      const v = env.mod.initBrowserView();
      expect(v.webContents.session.webRequest.onBeforeSendHeaders).toHaveBeenCalledWith(
        { urls: ['*://*/*'] },
        expect.any(Function)
      );
      expect(v.webContents.session.webRequest.onResponseStarted).toHaveBeenCalledWith(
        { urls: ['*://*/*'] },
        expect.any(Function)
      );
    });

    it('is idempotent while the existing view is alive', () => {
      env.mod.initBrowserView();
      env.mod.initBrowserView();
      expect(env.BrowserView).toHaveBeenCalledTimes(1);
    });

    it('creates a fresh view after the previous one is destroyed', () => {
      const v1 = env.mod.initBrowserView();
      v1.webContents.isDestroyed.mockReturnValue(true);
      env.mod.initBrowserView();
      expect(env.BrowserView).toHaveBeenCalledTimes(2);
    });
  });
  describe('stream detection (onResponseStarted)', () => {
    function fire(details) {
      const v = env.mod.initBrowserView();
      v.webContents.session.webRequest.onResponseStarted.mock.calls[0][1](details);
      return v;
    }

    it('ignores non-2xx responses', () => {
      fire({
        url: 'https://x.com/v.m3u8',
        statusCode: 404,
        bytesReceived: 1000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('captures an HLS .m3u8 stream (type HLS)', () => {
      fire({
        url: 'https://x.com/playlist.m3u8',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'HLS' })
      );
    });

    it('captures an MP4 stream (type MP4)', () => {
      fire({
        url: 'https://x.com/movie.mp4',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'MP4' })
      );
    });

    it('does not classify googlevideo .mp4 as MP4', () => {
      fire({
        url: 'https://googlevideo.com/v.mp4',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'MP4' })
      );
    });

    it('captures a .ts segment (type TS)', () => {
      fire({
        url: 'https://x.com/seg.ts',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'TS' })
      );
    });

    it('skips googletagmanager .ts', () => {
      fire({
        url: 'https://googletagmanager.com/x.ts',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('captures a .m4s segment (type DASH)', () => {
      fire({
        url: 'https://x.com/a.m4s',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'DASH' })
      );
    });

    it('captures .vtt subtitles (type SUBTITLE)', () => {
      fire({
        url: 'https://x.com/sub.vtt',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'SUBTITLE' })
      );
    });

    it('classifies content-type video/* as STREAM', () => {
      fire({
        url: 'https://x.com/blob?id=1',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: { 'content-type': ['video/mp4'] },
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'STREAM' })
      );
    });

    it('classifies content-type mpegurl as STREAM', () => {
      fire({
        url: 'https://x.com/blob?id=2',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: { 'content-type': ['application/vnd.apple.mpegurl'] },
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'STREAM' })
      );
    });

    it('skips known ad/tracking patterns', () => {
      fire({
        url: 'https://google-analytics.com/collect.mp4',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('skips static image extensions when not disguised', () => {
      fire({
        url: 'https://x.com/poster.jpg',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('skips plain .txt that is not master.txt/index.txt', () => {
      fire({
        url: 'https://x.com/notes.txt',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('captures master.txt as an HLS playlist', () => {
      fire({
        url: 'https://x.com/master.txt',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'HLS' })
      );
    });

    it('captures index.txt as an HLS playlist', () => {
      fire({
        url: 'https://x.com/index.txt',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'HLS' })
      );
    });

    it('skips disguised .jpg segment files under /hls/', () => {
      fire({
        url: 'https://x.com/hls/image001.jpg',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('keeps a disguised .m3u8 under /hls/', () => {
      fire({
        url: 'https://x.com/hls/playlist.m3u8',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.objectContaining({ type: 'HLS' })
      );
    });

    it('skips seg-/chunk/index- fragments (non-m3u8)', () => {
      fire({
        url: 'https://x.com/seg-1.ts',
        statusCode: 200,
        bytesReceived: 100000,
        responseHeaders: {},
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('skips small (<50000B) non-video, non-sub, non-m3u8 bodies', () => {
      fire({
        url: 'https://x.com/data.bin',
        statusCode: 200,
        bytesReceived: 500,
        responseHeaders: { 'content-type': ['application/octet-stream'] },
      });
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:streamDetected',
        expect.anything()
      );
    });

    it('deduplicates identical URLs (only the first notifies)', () => {
      const v = env.mod.initBrowserView();
      const cb = v.webContents.session.webRequest.onResponseStarted.mock.calls[0][1];
      cb({
        url: 'https://x.com/p.m3u8',
        statusCode: 200,
        bytesReceived: 1000,
        responseHeaders: {},
      });
      cb({
        url: 'https://x.com/p.m3u8',
        statusCode: 200,
        bytesReceived: 1000,
        responseHeaders: {},
      });
      expect(env.mod.getCapturedStreams()).toHaveLength(1);
      expect(env.mainWindow.webContents.send).toHaveBeenCalledTimes(1);
    });

    it('streamInfo carries url/type/size/pageTitle/contentType/timestamp/id (and sizeMB via getter)', () => {
      fire({
        url: 'https://x.com/movie.mp4',
        statusCode: 200,
        bytesReceived: 12345,
        responseHeaders: { 'content-type': ['video/mp4'] },
      });
      const s = env.mod.getCapturedStreams()[0];
      expect(s.url).toBe('https://x.com/movie.mp4');
      expect(s.type).toBe('MP4');
      expect(s.size).toBe(12345);
      expect(s.pageTitle).toBe('Test Page');
      expect(s.contentType).toContain('video/mp4');
      expect(typeof s.timestamp).toBe('number');
      expect(typeof s.id).toBe('string');
      expect(s.sizeMB).toBe((12345 / 1024 / 1024).toFixed(2));
    });

    it('cleanUrl strips #fragment and exact fbclid param (utm_ is NOT prefix-stripped — documents source quirk)', () => {
      fire({
        url: 'https://x.com/p.m3u8?fbclid=xyz&utm_source=foo#frag',
        statusCode: 200,
        bytesReceived: 1000,
        responseHeaders: {},
      });
      // fbclid (exact key) is removed; utm_source stays because URLSearchParams.delete is exact-match,
      // not prefix-match — the source's `delete('utm_')` only removes a key literally named "utm_".
      expect(env.mod.getCapturedStreams()[0].url).toBe('https://x.com/p.m3u8?utm_source=foo');
    });
  });
  describe('navigator / bounds helpers', () => {
    it('resizeBrowserView sets bounds when a view exists', () => {
      env.mod.initBrowserView();
      env.mod.resizeBrowserView({ x: 0, y: 0, width: 800, height: 600 });
      expect(env.BrowserView.mock.results[0].value.setBounds).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });
    });

    it('resizeBrowserView is a no-op without a view', () => {
      expect(() => env.mod.resizeBrowserView({ x: 0, y: 0, width: 1, height: 1 })).not.toThrow();
      expect(env.BrowserView).not.toHaveBeenCalled();
    });

    it('showBrowserView attaches the existing view to the main window', () => {
      env.mod.initBrowserView();
      env.mod.showBrowserView();
      expect(env.mainWindow.setBrowserView).toHaveBeenCalledWith(
        env.BrowserView.mock.results[0].value
      );
    });

    it('showBrowserView lazily creates a view when none exists', () => {
      expect(env.BrowserView).not.toHaveBeenCalled();
      env.mod.showBrowserView();
      expect(env.BrowserView).toHaveBeenCalledTimes(1);
      expect(env.mainWindow.setBrowserView).toHaveBeenCalled();
    });

    it('showBrowserView is a no-op without a main window', () => {
      const e2 = setupModules({ windows: [] });
      expect(() => e2.mod.showBrowserView()).not.toThrow();
      expect(e2.BrowserView).not.toHaveBeenCalled();
    });

    it('hideBrowserView removes the view from the main window', () => {
      env.mod.initBrowserView();
      env.mod.hideBrowserView();
      expect(env.mainWindow.removeBrowserView).toHaveBeenCalledWith(
        env.BrowserView.mock.results[0].value
      );
    });

    it('hideBrowserView is a no-op without a main window', () => {
      const e2 = setupModules({ windows: [] });
      expect(() => e2.mod.hideBrowserView()).not.toThrow();
    });

    it('goBack navigates back when canGoBack', () => {
      const e2 = setupModules({ canGoBack: true });
      const v = e2.mod.initBrowserView();
      e2.mod.goBack();
      expect(v.webContents.goBack).toHaveBeenCalled();
    });

    it('goBack is a no-op when canGoBack is false', () => {
      const v = env.mod.initBrowserView();
      env.mod.goBack();
      expect(v.webContents.goBack).not.toHaveBeenCalled();
    });

    it('goForward navigates forward when canGoForward', () => {
      const e2 = setupModules({ canGoForward: true });
      const v = e2.mod.initBrowserView();
      e2.mod.goForward();
      expect(v.webContents.goForward).toHaveBeenCalled();
    });

    it('goForward is a no-op when canGoForward is false', () => {
      const v = env.mod.initBrowserView();
      env.mod.goForward();
      expect(v.webContents.goForward).not.toHaveBeenCalled();
    });

    it('reload reloads an existing view', () => {
      const v = env.mod.initBrowserView();
      env.mod.reload();
      expect(v.webContents.reload).toHaveBeenCalled();
    });

    it('reload is a no-op without a view', () => {
      expect(() => env.mod.reload()).not.toThrow();
    });
  });

  describe('webContents event wiring', () => {
    it('did-start-navigation on main frame notifies browser:urlChanged', () => {
      const v = env.mod.initBrowserView();
      const cb = v.webContents.on.mock.calls.find((c) => c[0] === 'did-start-navigation')[1];
      cb({}, 'https://x.com/page', false, true); // isMainFrame=true
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:urlChanged',
        'https://x.com/page'
      );
    });

    it('did-start-navigation on a sub frame does not notify', () => {
      const v = env.mod.initBrowserView();
      const cb = v.webContents.on.mock.calls.find((c) => c[0] === 'did-start-navigation')[1];
      cb({}, 'https://x.com/frame', false, false);
      expect(env.mainWindow.webContents.send).not.toHaveBeenCalledWith(
        'browser:urlChanged',
        expect.anything()
      );
    });

    it('page-title-updated notifies browser:titleChanged', () => {
      const v = env.mod.initBrowserView();
      const cb = v.webContents.on.mock.calls.find((c) => c[0] === 'page-title-updated')[1];
      cb({}, 'New Title');
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:titleChanged',
        'New Title'
      );
    });

    it('app-command browser-backward navigates back when allowed', () => {
      const e2 = setupModules({ canGoBack: true });
      const v = e2.mod.initBrowserView();
      const cb = v.webContents.on.mock.calls.find((c) => c[0] === 'app-command')[1];
      cb({}, 'browser-backward');
      expect(v.webContents.goBack).toHaveBeenCalled();
    });

    it('app-command browser-forward navigates forward when allowed', () => {
      const e2 = setupModules({ canGoForward: true });
      const v = e2.mod.initBrowserView();
      const cb = v.webContents.on.mock.calls.find((c) => c[0] === 'app-command')[1];
      cb({}, 'browser-forward');
      expect(v.webContents.goForward).toHaveBeenCalled();
    });

    it('app-command browser-backward is a no-op when cannot go back', () => {
      const v = env.mod.initBrowserView();
      const cb = v.webContents.on.mock.calls.find((c) => c[0] === 'app-command')[1];
      cb({}, 'browser-backward');
      expect(v.webContents.goBack).not.toHaveBeenCalled();
    });
  });

  describe('captured streams API', () => {
    it('starts empty', () => {
      expect(env.mod.getCapturedStreams()).toEqual([]);
    });

    it('clearCapturedStreams empties the list', () => {
      const v = env.mod.initBrowserView();
      v.webContents.session.webRequest.onResponseStarted.mock.calls[0][1]({
        url: 'https://x.com/p.m3u8',
        statusCode: 200,
        bytesReceived: 1048576,
        responseHeaders: {},
      });
      expect(env.mod.getCapturedStreams()).toHaveLength(1);
      env.mod.clearCapturedStreams();
      expect(env.mod.getCapturedStreams()).toEqual([]);
    });
  });
  describe('downloadStream — happy path (non-HLS MP4)', () => {
    it('creates the output dir, registers the job, saves, and resolves on ffmpeg end', async () => {
      const fs = require('fs');
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const out = 'C:/Media/movie.mp4';
      const p = env.mod.downloadStream(stream, out);
      await flush();
      const endCb = env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1];
      endCb();
      await expect(p).resolves.toEqual({ success: true, path: out });
      expect(fs.mkdirSync).toHaveBeenCalledWith('C:/Media', { recursive: true });
      expect(env.commandMock.save).toHaveBeenCalledWith(out);
      expect(env.mod.getDownloads().some((d) => d.url === stream.url && d.outputPath === out)).toBe(
        true
      );
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:complete',
        expect.objectContaining({ outputPath: out })
      );
    });

    it('builds HLS reconnect/probe options for an .m3u8 stream', async () => {
      const stream = { url: 'https://x.com/playlist.m3u8', type: 'HLS', pageTitle: 'P' };
      const p = env.mod.downloadStream(stream, 'C:/Media/p.mp4');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
      const inputOpts = env.commandMock.inputOptions.mock.calls[0][0];
      expect(inputOpts).toContain('-protocol_whitelist');
      expect(inputOpts).toContain('-reconnect');
      expect(inputOpts).toContain('-analyzeduration');
      const outOpts = env.commandMock.outputOptions.mock.calls[0][0];
      expect(outOpts).toContain('-c:v');
      expect(outOpts).toContain('copy');
      expect(outOpts).toContain('-c:s');
      expect(outOpts).toContain('mov_text');
      expect(outOpts).toContain('-movflags');
      expect(outOpts).toContain('+faststart');
    });

    it('uses srt subtitle codec (no mov_text/faststart) for an .mkv output', async () => {
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/movie.mkv');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
      const outOpts = env.commandMock.outputOptions.mock.calls[0][0];
      expect(outOpts).toContain('srt');
      expect(outOpts).not.toContain('mov_text');
      expect(outOpts).not.toContain('+faststart');
    });

    it('passes -user_agent and -headers for a remote (non-local) input', async () => {
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
      const inputOpts = env.commandMock.inputOptions.mock.calls[0][0];
      expect(inputOpts).toContain('-user_agent');
      expect(inputOpts[1]).toContain('Mozilla/5.0');
    });

    it('does not add -user_agent for a local file input', async () => {
      const stream = { url: '/local/clip.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
      const inputOpts = env.commandMock.inputOptions.mock.calls[0][0];
      expect(inputOpts).not.toContain('-user_agent');
    });

    it('updates progress and notifies browser:progress', async () => {
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      const progCb = env.commandMock.on.mock.calls.find((c) => c[0] === 'progress')[1];
      progCb({ percent: 42, targetSize: 100 });
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:progress',
        expect.objectContaining({ percent: 42, status: 'downloading' })
      );
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
    });

    it('clamps progress percent to 100', async () => {
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      const progCb = env.commandMock.on.mock.calls.find((c) => c[0] === 'progress')[1];
      progCb({ percent: 250 });
      expect(env.mainWindow.webContents.send.mock.calls.some((c) => c[1].percent === 100)).toBe(
        true
      );
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
    });

    it('uses sizeKB when progress has no percent', async () => {
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      const progCb = env.commandMock.on.mock.calls.find((c) => c[0] === 'progress')[1];
      progCb({ targetSize: 500 }); // no percent
      expect(env.mainWindow.webContents.send.mock.calls.some((c) => c[1].sizeKB === 500)).toBe(
        true
      );
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
    });

    it('rejects with "Download failed: <msg>" on ffmpeg error', async () => {
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'error')[1](new Error('boom'));
      await expect(p).rejects.toThrow('Download failed: boom');
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:error',
        expect.objectContaining({ error: 'boom' })
      );
    });
  });

  describe('downloadStream — captures request headers', () => {
    it('uses captured referer/cookie/origin/authorization as -headers string', async () => {
      const v = env.mod.initBrowserView();
      // Prime requestHeadersMap via onBeforeSendHeaders for the stream URL.
      const beforeCb = v.webContents.session.webRequest.onBeforeSendHeaders.mock.calls[0][1];
      const headers = {
        Referer: 'https://x.com/watch',
        Cookie: 'sid=1',
        Origin: 'https://x.com',
        authorization: 'Bearer t',
        'X-Other': 'z',
      };
      beforeCb({ url: 'https://x.com/movie.mp4', requestHeaders: headers }, () => {});
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
      const inputOpts = env.commandMock.inputOptions.mock.calls[0][0];
      expect(inputOpts).toContain('-headers');
      const headerStr = inputOpts[inputOpts.indexOf('-headers') + 1];
      expect(headerStr).toContain('Referer: https://x.com/watch');
      expect(headerStr).toContain('Cookie: sid=1');
      expect(headerStr).toContain('Origin: https://x.com');
      expect(headerStr).toContain('authorization: Bearer t');
      expect(headerStr).not.toContain('X-Other'); // only the 4 blessed header keys are kept
    });

    it('uses the captured User-Agent when present', async () => {
      const v = env.mod.initBrowserView();
      const beforeCb = v.webContents.session.webRequest.onBeforeSendHeaders.mock.calls[0][1];
      beforeCb(
        { url: 'https://x.com/movie.mp4', requestHeaders: { 'User-Agent': 'MyUA/1.0' } },
        () => {}
      );
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const p = env.mod.downloadStream(stream, 'C:/Media/m.mp4');
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
      const inputOpts = env.commandMock.inputOptions.mock.calls[0][0];
      expect(inputOpts[inputOpts.indexOf('-user_agent') + 1]).toBe('MyUA/1.0');
    });
  });
  describe('downloadStream — SUBTITLE standalone fetch', () => {
    it('fetches the subtitle, writes a temp file, uses it locally, and cleans up on end', async () => {
      const fs = require('fs');
      env.net.fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('WEBVTT\n') });
      const stream = { url: 'https://x.com/sub.vtt', type: 'SUBTITLE', pageTitle: 'S' };
      const out = 'C:/Media/sub.vtt';
      const p = env.mod.downloadStream(stream, out);
      await flush();
      expect(env.net.fetch).toHaveBeenCalledWith(
        'https://x.com/sub.vtt',
        expect.objectContaining({
          headers: expect.objectContaining({ 'User-Agent': expect.any(String) }),
        })
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('zenith_standalone_sub'),
        'WEBVTT\n'
      );
      expect(env.commandMock.save).toHaveBeenCalledWith(out);
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await expect(p).resolves.toEqual({ success: true, path: out });
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('zenith_standalone_sub'),
        expect.any(Function)
      );
    });

    it('rejects with "Subtitle download failed (HTTP <status>)" when fetch !ok', async () => {
      env.net.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const stream = { url: 'https://x.com/sub.vtt', type: 'SUBTITLE', pageTitle: 'S' };
      await expect(env.mod.downloadStream(stream, 'C:/Media/sub.vtt')).rejects.toThrow(
        'Subtitle download failed (HTTP 404)'
      );
    });

    it('rejects with "Subtitle fetch error" when net.fetch throws', async () => {
      env.net.fetch.mockRejectedValueOnce(new Error('network down'));
      const stream = { url: 'https://x.com/sub.vtt', type: 'SUBTITLE', pageTitle: 'S' };
      await expect(env.mod.downloadStream(stream, 'C:/Media/sub.vtt')).rejects.toThrow(
        'Subtitle fetch error: network down'
      );
    });
  });

  describe('downloadStream — external subtitle merge', () => {
    it('downloads an English external subtitle and adds it as input with metadata', async () => {
      const fs = require('fs');
      // Capture a SUBTITLE stream first so capturedStreams has an external sub.
      const v = env.mod.initBrowserView();
      v.webContents.session.webRequest.onResponseStarted.mock.calls[0][1]({
        url: 'https://x.com/sub_eng.vtt',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      env.net.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('WEBVTT ENG\n'),
      });
      const stream = { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' };
      const out = 'C:/Media/movie.mkv';
      const p = env.mod.downloadStream(stream, out);
      await flush();
      expect(env.net.fetch).toHaveBeenCalledWith('https://x.com/sub_eng.vtt', expect.any(Object));
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('zenith_sub'),
        'WEBVTT ENG\n'
      );
      expect(env.commandMock.input).toHaveBeenCalledWith(expect.stringContaining('zenith_sub'));
      const outOpts = env.commandMock.outputOptions.mock.calls[0][0];
      expect(outOpts).toContain('-map');
      expect(outOpts).toContain('1:s?');
      expect(outOpts).toContain('language=eng');
      expect(outOpts).toContain('title=English');
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await expect(p).resolves.toEqual({ success: true, path: out });
    });

    it('labels a forced subtitle as Turkish (Forced)', async () => {
      const v = env.mod.initBrowserView();
      v.webContents.session.webRequest.onResponseStarted.mock.calls[0][1]({
        url: 'https://x.com/sub_forced.vtt',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      env.net.fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('WEBVTT\n') });
      const p = env.mod.downloadStream(
        { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' },
        'C:/Media/m.mkv'
      );
      await flush();
      const outOpts = env.commandMock.outputOptions.mock.calls[0][0];
      expect(outOpts).toContain('language=tur');
      expect(outOpts.some((o) => typeof o === 'string' && o.includes('Forced'))).toBe(true);
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
    });

    it('skips an external subtitle whose fetch returns !ok (continue)', async () => {
      const v = env.mod.initBrowserView();
      v.webContents.session.webRequest.onResponseStarted.mock.calls[0][1]({
        url: 'https://x.com/sub_eng.vtt',
        statusCode: 200,
        bytesReceived: 5000,
        responseHeaders: {},
      });
      env.net.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
      const p = env.mod.downloadStream(
        { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' },
        'C:/Media/m.mkv'
      );
      await flush();
      expect(env.commandMock.input).not.toHaveBeenCalled();
      expect(env.commandMock.save).toHaveBeenCalled();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await p;
    });
  });
  describe('download lifecycle helpers', () => {
    it('cancelDownload kills the ffmpeg command and marks the job cancelled', async () => {
      const p = env.mod.downloadStream(
        { url: 'https://x.com/movie.mp4', type: 'MP4', pageTitle: 'M' },
        'C:/Media/m.mp4'
      );
      p.catch(() => {}); // swallow eventual rejection so the run stays clean
      await flush();
      const jobId = env.mod.getDownloads()[0].id;
      env.mod.cancelDownload(jobId);
      expect(env.commandMock.kill).toHaveBeenCalledWith('SIGKILL');
      expect(env.mod.getDownloads()[0].status).toBe('cancelled');
      expect(env.mainWindow.webContents.send).toHaveBeenCalledWith(
        'browser:cancelDownload',
        expect.objectContaining({ jobId })
      );
      env.commandMock.on.mock.calls.find((c) => c[0] === 'error')[1](new Error('killed'));
      await flush();
    });

    it('cancelDownload is a no-op for an unknown job id', () => {
      env.mod.cancelDownload('does-not-exist');
      expect(env.commandMock.kill).not.toHaveBeenCalled();
    });

    it('clearCompletedDownloads removes completed jobs', async () => {
      const p = env.mod.downloadStream(
        { url: 'https://x.com/a.mp4', type: 'MP4', pageTitle: 'A' },
        'C:/Media/a.mp4'
      );
      p.catch(() => {});
      await flush();
      expect(env.mod.getDownloads()).toHaveLength(1);
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1](); // complete it
      await flush();
      expect(env.mod.getDownloads()[0].status).toBe('completed');
      env.mod.clearCompletedDownloads();
      expect(env.mod.getDownloads()).toHaveLength(0);
    });

    it('clearCompletedDownloads removes cancelled jobs', async () => {
      // One download per test so the jobId (Date.now ms) is unique.
      const p = env.mod.downloadStream(
        { url: 'https://x.com/a.mp4', type: 'MP4', pageTitle: 'A' },
        'C:/Media/a.mp4'
      );
      p.catch(() => {});
      await flush();
      env.mod.cancelDownload(env.mod.getDownloads()[0].id);
      expect(env.mod.getDownloads()[0].status).toBe('cancelled');
      env.mod.clearCompletedDownloads();
      expect(env.mod.getDownloads()).toHaveLength(0);
      env.commandMock.on.mock.calls.find((c) => c[0] === 'error')[1](new Error('killed'));
      await flush();
    });

    it('clearCompletedDownloads removes failed jobs', async () => {
      const p = env.mod.downloadStream(
        { url: 'https://x.com/a.mp4', type: 'MP4', pageTitle: 'A' },
        'C:/Media/a.mp4'
      );
      await flush();
      env.commandMock.on.mock.calls.find((c) => c[0] === 'error')[1](new Error('boom'));
      await expect(p).rejects.toThrow('Download failed: boom');
      await flush();
      expect(env.mod.getDownloads()[0].status).toBe('failed');
      env.mod.clearCompletedDownloads();
      expect(env.mod.getDownloads()).toHaveLength(0);
    });

    it('getDownloads returns serializable job shapes', async () => {
      const p = env.mod.downloadStream(
        { url: 'https://x.com/a.mp4', type: 'MP4', pageTitle: 'A' },
        'C:/Media/a.mp4'
      );
      p.catch(() => {});
      await flush();
      const d = env.mod.getDownloads()[0];
      expect(d).toEqual(
        expect.objectContaining({
          url: 'https://x.com/a.mp4',
          outputPath: 'C:/Media/a.mp4',
          title: 'A',
          status: 'starting',
          percent: 0,
        })
      );
      env.commandMock.on.mock.calls.find((c) => c[0] === 'end')[1]();
      await flush();
    });
  });
});
