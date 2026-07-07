import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const os = require('os');
const electron = require('electron');

describe('ffmpegHelper', () => {
  let originalPlatform;
  let mockFfmpegObj;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = os.platform;
    mockFfmpegObj = global.__ffmpegMockObj;
    
    // Clear the mock calls on the global mock object
    if (mockFfmpegObj) {
      if (mockFfmpegObj.setFfmpegPath) mockFfmpegObj.setFfmpegPath.mockClear();
      if (mockFfmpegObj.setFfprobePath) mockFfmpegObj.setFfprobePath.mockClear();
    }
  });

  afterEach(() => {
    os.platform = originalPlatform;
    electron.app.isPackaged = false; // Reset to default
  });

  const loadFfmpegHelper = () => {
    delete require.cache[require.resolve('./ffmpegHelper.js')];
    return require('./ffmpegHelper.js');
  };

  it('sets win32 unpacked paths correctly', () => {
    os.platform = () => 'win32';
    electron.app.isPackaged = false;
    const ffmpeg = loadFfmpegHelper();
    
    expect(ffmpeg.setFfmpegPath).toHaveBeenCalled();
    const arg = ffmpeg.setFfmpegPath.mock.calls[0][0];
    expect(arg.includes('win')).toBe(true);
    expect(arg.endsWith('.exe')).toBe(true);
  });

  it('sets linux unpacked paths correctly', () => {
    os.platform = () => 'linux';
    electron.app.isPackaged = false;
    const ffmpeg = loadFfmpegHelper();
    
    expect(ffmpeg.setFfmpegPath).toHaveBeenCalled();
    const arg = ffmpeg.setFfmpegPath.mock.calls[0][0];
    expect(arg.includes('linux')).toBe(true);
    expect(arg.endsWith('.exe')).toBe(false);
  });

  it('sets darwin unpacked paths correctly', () => {
    os.platform = () => 'darwin';
    electron.app.isPackaged = false;
    const ffmpeg = loadFfmpegHelper();
    
    expect(ffmpeg.setFfmpegPath).toHaveBeenCalled();
    const arg = ffmpeg.setFfmpegPath.mock.calls[0][0];
    expect(arg.includes('mac')).toBe(true);
    expect(arg.endsWith('.exe')).toBe(false);
  });

  it('handles unknown platform', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    os.platform = () => 'unknown';
    electron.app.isPackaged = false;
    const ffmpeg = loadFfmpegHelper();
    
    expect(consoleSpy).toHaveBeenCalledWith('Unsuported ', 'unknown');
    consoleSpy.mockRestore();
  });

  it('handles packaged app correctly', () => {
    process.resourcesPath = '/mock/resources';
    os.platform = () => 'win32';
    electron.app.isPackaged = true;
    const ffmpeg = loadFfmpegHelper();
    
    expect(ffmpeg.setFfmpegPath).toHaveBeenCalled();
    const arg = ffmpeg.setFfmpegPath.mock.calls[0][0];
    expect(arg).toContain('mock');
    delete process.resourcesPath;
  });
});
