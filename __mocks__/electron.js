const { vi } = require('vitest');
module.exports = {
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('C:\\Media'),
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
};
