import { vi } from 'vitest';

vi.mock('electron', () => {
  const electronMock = {
    app: {
      isPackaged: false,
      getPath: vi.fn(() => 'C:\\MockPath'),
      commandLine: { appendSwitch: vi.fn() },
      disableHardwareAcceleration: vi.fn(),
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
    },
    dialog: {
      showSaveDialog: vi.fn(() => Promise.resolve({ filePath: 'mockPath' })),
      showOpenDialog: vi.fn(() => Promise.resolve({ filePaths: [] })),
    },
    BrowserWindow: class {
      constructor() {
        this.webContents = {
          on: vi.fn(),
          openDevTools: vi.fn(),
        };
      }
      static getAllWindows() { return []; }
      loadURL() {}
      loadFile() {}
    },
    protocol: {
      registerFileProtocol: vi.fn(),
    },
    net: {
      fetch: vi.fn(() => Promise.resolve()),
    }
  };
  return { ...electronMock, default: electronMock };
});
