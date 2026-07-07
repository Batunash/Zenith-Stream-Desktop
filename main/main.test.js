import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const Module = require('module');

// Rich electron mock with a deferred whenReady so tests fire the ready callback
// on demand. Built fresh per-test so mock call history is isolated.
let readyCb = null;
function buildElectronMock() {
  readyCb = null;
  const readyable = {
    then: (cb) => {
      readyCb = cb;
    },
  };

  class MockBrowserWindow {
    constructor(opts) {
      MockBrowserWindow.lastOpts = opts;
      MockBrowserWindow.instances.push(this);
      this.webContents = {
        on: vi.fn(),
        loadURL: vi.fn(),
        loadFile: vi.fn(),
        openDevTools: vi.fn(),
      };
      this.on = vi.fn();
      this.loadURL = vi.fn();
      this.loadFile = vi.fn();
    }
    static getAllWindows = vi.fn(function () {
      return MockBrowserWindow.instances;
    });
  }
  MockBrowserWindow.instances = [];
  MockBrowserWindow.lastOpts = null;

  const app = {
    isPackaged: false,
    commandLine: { appendSwitch: vi.fn() },
    disableHardwareAcceleration: vi.fn(),
    whenReady: vi.fn(() => readyable),
    on: vi.fn(),
    getPath: vi.fn((name) => `C:\\mock-${name}`),
    quit: vi.fn(),
  };

  return {
    app,
    BrowserWindow: MockBrowserWindow,
    protocol: { registerFileProtocol: vi.fn() },
    net: vi.fn(),
    __bw: MockBrowserWindow,
  };
}

// 9 IPC registration module mocks (shared via vi.hoisted so vi.mock factory
// and require.cache injection can reference the SAME vi.fn instances).
const ipcMocks = vi.hoisted(() => {
  const fns = {};
  [
    'serverControl',
    'fileControl',
    'dialogManager',
    'authControl',
    'settingsControl',
    'windowControl',
    'translateControl',
    'burnControl',
    'browserDownloaderControl',
  ].forEach((m) => {
    fns[m] = vi.fn();
  });
  return fns;
});

vi.mock('./ipc/serverControl', () => ipcMocks.serverControl);
vi.mock('./ipc/fileControl', () => ipcMocks.fileControl);
vi.mock('./ipc/dialogManager', () => ipcMocks.dialogManager);
vi.mock('./ipc/authControl', () => ipcMocks.authControl);
vi.mock('./ipc/settingsControl', () => ipcMocks.settingsControl);
vi.mock('./ipc/windowControl', () => ipcMocks.windowControl);
vi.mock('./ipc/translateControl', () => ipcMocks.translateControl);
vi.mock('./ipc/burnControl', () => ipcMocks.burnControl);
vi.mock('./ipc/browserDownloaderControl', () => ipcMocks.browserDownloaderControl);

let electronMock;
let originalRequire;
let originalNodeEnv;
let originalPlatform;

const IPC_MODULES = [
  'serverControl',
  'fileControl',
  'dialogManager',
  'authControl',
  'settingsControl',
  'windowControl',
  'translateControl',
  'burnControl',
  'browserDownloaderControl',
];

function fireReady() {
  if (readyCb) readyCb();
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(ipcMocks).forEach((fn) => fn.mockClear());
  global.__fsMock.appendFileSync = vi.fn();
  electronMock = buildElectronMock();
  originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'electron') return electronMock;
    return originalRequire.apply(this, arguments);
  };
  originalNodeEnv = process.env.NODE_ENV;
  originalPlatform = process.platform;
  // Inject require.cache so CJS require('./ipc/<m>') returns our vi.fn (belt-and-suspenders
  // alongside vi.mock, mirroring the auth.test.js CJS interop pattern).
  IPC_MODULES.forEach((m) => {
    const resolved = require.resolve(`./ipc/${m}`);
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: ipcMocks[m],
      children: [],
      paths: [],
    };
  });
  delete require.cache[require.resolve('./main')];
});

afterEach(() => {
  Module.prototype.require = originalRequire;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
  IPC_MODULES.forEach((m) => {
    delete require.cache[require.resolve(`./ipc/${m}`)];
  });
});

describe('Electron Main Process', () => {
  describe('Hardware Acceleration Setup (top-level)', () => {
    it('disables the GPU and compositing switches', () => {
      require('./main');
      const sw = electronMock.app.commandLine.appendSwitch;
      expect(sw).toHaveBeenCalledWith('disable-gpu');
      expect(sw).toHaveBeenCalledWith('disable-gpu-compositing');
      expect(sw).toHaveBeenCalledWith('disable-software-rasterizer');
    });

    it('disables the Vaapi/Ozone features', () => {
      require('./main');
      expect(electronMock.app.commandLine.appendSwitch).toHaveBeenCalledWith(
        'disable-features',
        'VaapiVideoDecoder,UseOzonePlatform'
      );
    });

    it('sets the ozone platform to x11', () => {
      require('./main');
      expect(electronMock.app.commandLine.appendSwitch).toHaveBeenCalledWith(
        'ozone-platform',
        'x11'
      );
    });

    it('disableHardwareAcceleration is called', () => {
      require('./main');
      expect(electronMock.app.disableHardwareAcceleration).toHaveBeenCalled();
    });
  });

  describe('Window Creation (whenReady)', () => {
    it('creates a BrowserWindow with 1280x850 dimensions', () => {
      require('./main');
      fireReady();
      expect(electronMock.BrowserWindow.lastOpts.width).toBe(1280);
      expect(electronMock.BrowserWindow.lastOpts.height).toBe(850);
    });

    it('creates a frameless window with the dark background', () => {
      require('./main');
      fireReady();
      expect(electronMock.BrowserWindow.lastOpts.frame).toBe(false);
      expect(electronMock.BrowserWindow.lastOpts.backgroundColor).toBe('#0d0d0d');
    });

    it('uses contextIsolation true and nodeIntegration false', () => {
      require('./main');
      fireReady();
      const wp = electronMock.BrowserWindow.lastOpts.webPreferences;
      expect(wp.contextIsolation).toBe(true);
      expect(wp.nodeIntegration).toBe(false);
    });

    it('sets a preload path string', () => {
      require('./main');
      fireReady();
      const preload = electronMock.BrowserWindow.lastOpts.webPreferences.preload;
      expect(typeof preload).toBe('string');
      expect(preload.length).toBeGreaterThan(0);
    });

    it('attaches a console-message listener on webContents', () => {
      require('./main');
      fireReady();
      const wc = electronMock.BrowserWindow.instances[0].webContents;
      expect(wc.on).toHaveBeenCalledWith('console-message', expect.any(Function));
    });

    it('loads the local file in production/default (NODE_ENV=test) mode', () => {
      require('./main');
      fireReady();
      const win = electronMock.BrowserWindow.instances[0];
      expect(win.loadFile).toHaveBeenCalled();
      expect(win.loadURL).not.toHaveBeenCalled();
    });

    it('loads the dev URL when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      require('./main');
      fireReady();
      const win = electronMock.BrowserWindow.instances[0];
      expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173/renderer/index.html');
      expect(win.webContents.openDevTools).toHaveBeenCalled();
    });
  });

  describe('IPC Handler Registration (whenReady)', () => {
    it('calls every IPC registration module exactly once', () => {
      require('./main');
      fireReady();
      IPC_MODULES.forEach((m) => {
        expect(ipcMocks[m]).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Protocol Handler (whenReady)', () => {
    it('registers the "media" file protocol', () => {
      require('./main');
      fireReady();
      expect(electronMock.protocol.registerFileProtocol).toHaveBeenCalledWith(
        'media',
        expect.any(Function)
      );
    });

    it('handler resolves an absolute decoded URL directly', () => {
      require('./main');
      fireReady();
      const handler = electronMock.protocol.registerFileProtocol.mock.calls[0][1];
      const cb = vi.fn();
      const absolutePath = process.platform === 'win32' ? 'C:/test/video.mp4' : '/test/video.mp4';
      const encodedUrl = 'media://' + encodeURIComponent(absolutePath);
      handler({ url: encodedUrl }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ path: absolutePath }));
    });

    it('handler joins userData for a relative path', () => {
      require('./main');
      fireReady();
      const handler = electronMock.protocol.registerFileProtocol.mock.calls[0][1];
      const cb = vi.fn();
      handler({ url: 'media://relative%20clip.mp4' }, cb);
      expect(cb).toHaveBeenCalled();
      const resolved = cb.mock.calls[0][0].path;
      expect(typeof resolved).toBe('string');
      expect(resolved).toContain('mock-userData');
    });
  });

  describe('App Lifecycle', () => {
    it('registers a window-all-closed handler at top level', () => {
      require('./main');
      expect(electronMock.app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
    });

    it('quits on non-darwin when all windows closed', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      require('./main');
      const cb = electronMock.app.on.mock.calls.find((c) => c[0] === 'window-all-closed')[1];
      cb();
      expect(electronMock.app.quit).toHaveBeenCalled();
    });

    it('does not quit on darwin when all windows closed', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
      require('./main');
      const cb = electronMock.app.on.mock.calls.find((c) => c[0] === 'window-all-closed')[1];
      cb();
      expect(electronMock.app.quit).not.toHaveBeenCalled();
    });

    it('registers an activate handler inside whenReady', () => {
      require('./main');
      fireReady();
      const activate = electronMock.app.on.mock.calls.find((c) => c[0] === 'activate');
      expect(activate).toBeDefined();
    });

    it('creates a new window on activate when none exist', () => {
      require('./main');
      fireReady();
      const before = electronMock.BrowserWindow.instances.length;
      electronMock.BrowserWindow.getAllWindows.mockReturnValue([]);
      const cb = electronMock.app.on.mock.calls.find((c) => c[0] === 'activate')[1];
      cb();
      expect(electronMock.BrowserWindow.instances.length).toBe(before + 1);
    });

    it('does not create a new window on activate when windows exist', () => {
      require('./main');
      fireReady();
      const before = electronMock.BrowserWindow.instances.length;
      electronMock.BrowserWindow.getAllWindows.mockReturnValue([{}]);
      const cb = electronMock.app.on.mock.calls.find((c) => c[0] === 'activate')[1];
      cb();
      expect(electronMock.BrowserWindow.instances.length).toBe(before);
    });
  });

  describe('Console Message Handler', () => {
    it('appends console messages to frontend.log via fs', () => {
      require('./main');
      fireReady();
      const wc = electronMock.BrowserWindow.instances[0].webContents;
      const handler = wc.on.mock.calls.find((c) => c[0] === 'console-message')[1];
      handler(null, 0, 'hello console');
      expect(global.__fsMock.appendFileSync).toHaveBeenCalledWith(
        'frontend.log',
        'hello console\n'
      );
    });
  });
});
