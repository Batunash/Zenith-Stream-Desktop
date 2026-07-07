import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMain, BrowserWindow } = require('electron');
const registerWindowControl = require('./windowControl');

describe('windowControl', () => {
  let mockWindow;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWindow = {
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMaximized: vi.fn().mockReturnValue(false),
      close: vi.fn(),
    };

    vi.spyOn(BrowserWindow, 'fromWebContents').mockReturnValue(mockWindow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers window IPC handlers', () => {
    registerWindowControl();
    const calls = ipcMain.on.mock.calls.map((c) => c[0]);
    expect(calls).toContain('window:minimize');
    expect(calls).toContain('window:maximize');
    expect(calls).toContain('window:close');
  });

  it('minimizes window on window:minimize', () => {
    registerWindowControl();
    const handler = ipcMain.on.mock.calls.find((c) => c[0] === 'window:minimize')[1];

    handler({ sender: {} });
    expect(mockWindow.minimize).toHaveBeenCalled();
  });

  it('maximizes window if not maximized on window:maximize', () => {
    registerWindowControl();
    const handler = ipcMain.on.mock.calls.find((c) => c[0] === 'window:maximize')[1];

    handler({ sender: {} });
    expect(mockWindow.maximize).toHaveBeenCalled();
    expect(mockWindow.unmaximize).not.toHaveBeenCalled();
  });

  it('unmaximizes window if maximized on window:maximize', () => {
    registerWindowControl();
    const handler = ipcMain.on.mock.calls.find((c) => c[0] === 'window:maximize')[1];

    mockWindow.isMaximized.mockReturnValue(true);
    handler({ sender: {} });
    expect(mockWindow.unmaximize).toHaveBeenCalled();
    expect(mockWindow.maximize).not.toHaveBeenCalled();
  });

  it('closes window on window:close', () => {
    registerWindowControl();
    const handler = ipcMain.on.mock.calls.find((c) => c[0] === 'window:close')[1];

    handler({ sender: {} });
    expect(mockWindow.close).toHaveBeenCalled();
  });

  it('does nothing if window is null', () => {
    registerWindowControl();
    const handlers = ipcMain.on.mock.calls;

    BrowserWindow.fromWebContents.mockReturnValue(null);

    handlers.forEach((h) => {
      h[1]({ sender: {} });
    });

    expect(mockWindow.minimize).not.toHaveBeenCalled();
    expect(mockWindow.maximize).not.toHaveBeenCalled();
    expect(mockWindow.unmaximize).not.toHaveBeenCalled();
    expect(mockWindow.close).not.toHaveBeenCalled();
  });
});
