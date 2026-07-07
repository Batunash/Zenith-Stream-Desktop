import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fs = require('fs');
const { ipcMain } = require('electron');
vi.mock('../utils/burnExternalSubtitle');
const burner = require('../utils/burnExternalSubtitle');

const registerBurnControl = require('./burnControl');

describe('burnControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    if (burner.burnExternalSrt.mockImplementation) {
      burner.burnExternalSrt.mockImplementation(async (video, srt, onProgress) => {
        onProgress(50);
      });
    } else {
      burner.burnExternalSrt = vi.fn().mockImplementation(async (video, srt, onProgress) => {
        onProgress(50);
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers burn IPC handler', () => {
    registerBurnControl();
    const calls = ipcMain.handle.mock.calls.map((c) => c[0]);
    expect(calls).toContain('media:burnExternalSubtitle');
  });

  it('fails if video path is missing', async () => {
    registerBurnControl();
    const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:burnExternalSubtitle')[1];

    const result = await handler({}, { srtPath: 'test.srt' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NO_VIDEO');
  });

  it('fails if video file does not exist', async () => {
    registerBurnControl();
    const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:burnExternalSubtitle')[1];

    fs.existsSync.mockImplementation((p) => p !== 'test.mkv');

    const result = await handler({}, { videoPath: 'test.mkv', srtPath: 'test.srt' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NO_VIDEO');
  });

  it('fails if srt file does not exist', async () => {
    registerBurnControl();
    const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:burnExternalSubtitle')[1];

    fs.existsSync.mockImplementation((p) => p !== 'test.srt');

    const result = await handler({}, { videoPath: 'test.mkv', srtPath: 'test.srt' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NO_SRT');
  });

  it('succeeds and sends progress', async () => {
    registerBurnControl();
    const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:burnExternalSubtitle')[1];

    const event = { sender: { send: vi.fn() } };

    const result = await handler(event, { videoPath: 'test.mkv', srtPath: 'test.srt' });

    expect(result.success).toBe(true);
    expect(event.sender.send).toHaveBeenCalledWith('media:burnExternalSubtitle:progress', {
      percent: 0,
    });
    expect(event.sender.send).toHaveBeenCalledWith('media:burnExternalSubtitle:progress', {
      percent: 50,
    });
    expect(event.sender.send).toHaveBeenCalledWith('media:burnExternalSubtitle:progress', {
      percent: 100,
    });
    expect(burner.burnExternalSrt).toHaveBeenCalledWith(
      'test.mkv',
      'test.srt',
      expect.any(Function)
    );
  });

  it('handles burn errors', async () => {
    registerBurnControl();
    const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:burnExternalSubtitle')[1];

    burner.burnExternalSrt.mockRejectedValue(new Error('Burn error'));
    const event = { sender: { send: vi.fn() } };

    const result = await handler(event, { videoPath: 'test.mkv', srtPath: 'test.srt' });

    expect(result.success).toBe(false);
    expect(result.code).toBe('BURN_FAILED');
  });
});
