import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

window.api = {
  invoke: vi.fn(),
  paths: { userData: 'C:/mock/userdata' },
};

const mockIpcMain = { handle: vi.fn(), on: vi.fn(), send: vi.fn() };
const mockApp = {
  isPackaged: false,
  getPath: vi.fn().mockReturnValue('C:\\Media'),
  relaunch: vi.fn(),
  exit: vi.fn(),
};
const mockDialog = { showOpenDialog: vi.fn() };
const mockBrowserWindow = { fromWebContents: vi.fn() };

// ─── Global fs mock ─────────────────────────────────────────────────────────
// existsSync defaults to FALSE → database.js creates fresh empty in-memory DB
// (not trying to read invalid data from disk)
const mockFs = {
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false, size: 100 }),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(undefined),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
  cpSync: vi.fn(),
  rmSync: vi.fn(),
  createReadStream: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  createWriteStream: vi.fn(),
  unlink: vi.fn().mockImplementation((_p, cb) => cb && cb(null)),
};
global.__fsMock = mockFs;

// ─── Global sql.js mock ──────────────────────────────────────────────────────
const _mockSqlDb = {
  run: vi.fn(),
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn(),
    step: vi.fn().mockReturnValue(false),
    free: vi.fn(),
    getAsObject: vi.fn().mockReturnValue({}),
  }),
  exec: vi.fn().mockReturnValue([{ values: [[1]] }]),
  export: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
};
const _mockSqlConstructor = function MockDatabase() {
  return _mockSqlDb;
};
const _mockInitSqlJs = vi.fn().mockResolvedValue({ Database: _mockSqlConstructor });
global.__sqlJsMock = { initSqlJs: _mockInitSqlJs, Database: _mockSqlConstructor, db: _mockSqlDb };

// ─── Global bcrypt mock ──────────────────────────────────────────────────────
const mockBcrypt = {
  hash: vi.fn().mockResolvedValue('hashed'),
  compare: vi.fn().mockResolvedValue(true),
  hashSync: vi.fn().mockReturnValue('hashed'),
  compareSync: vi.fn().mockReturnValue(true),
};
global.__bcryptMock = mockBcrypt;

// ─── CJS require interceptor ─────────────────────────────────────────────────
// ONLY intercept npm packages (not local project files).
// Local files are mocked via vi.mock() in test files — vitest's transform
// handles the CJS require() calls inside those files correctly.
// Using Module._resolveFilename or suffix matching for local files causes
// conflicts with vi.mock and breaks tests that rely on the real modules.
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'electron') {
    return {
      app: mockApp,
      ipcMain: mockIpcMain,
      dialog: mockDialog,
      BrowserWindow: mockBrowserWindow,
    };
  }
  if (id === 'fs') {
    return mockFs;
  }
  if (id === 'bcryptjs') {
    return mockBcrypt;
  }
  if (id === 'sql.js') {
    return global.__sqlJsMock.initSqlJs;
  }
  if (id === 'axios') {
    // Provide a mockable axios object for CJS requires
    if (!global.__axiosMock) {
      global.__axiosMock = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        create: vi.fn().mockReturnThis(),
      };
    }
    return global.__axiosMock;
  }
  if (id === 'fluent-ffmpeg') {
    const mockObj = {
      input: vi.fn().mockReturnThis(),
      output: vi.fn().mockReturnThis(),
      videoCodec: vi.fn().mockReturnThis(),
      audioCodec: vi.fn().mockReturnThis(),
      outputOptions: vi.fn().mockReturnThis(),
      videoFilters: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      run: vi.fn().mockImplementation(function () {
        const endCb = this.on.mock.calls.find((c) => c[0] === 'end')?.[1];
        if (endCb) endCb();
        return this;
      }),
    };
    const mockFn = vi.fn().mockReturnValue(mockObj);
    mockFn.setFfmpegPath = vi.fn();
    mockFn.setFfprobePath = vi.fn();
    global.__ffmpegMockObj = mockObj;
    return mockFn;
  }
  return originalRequire.apply(this, arguments);
};

vi.mock('electron', () => ({
  __esModule: true,
  app: mockApp,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  BrowserWindow: mockBrowserWindow,
  default: {
    app: mockApp,
    ipcMain: mockIpcMain,
    dialog: mockDialog,
    BrowserWindow: mockBrowserWindow,
  },
}));
