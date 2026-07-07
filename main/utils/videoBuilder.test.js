import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs');
vi.mock('../../backend/src/services/mediaService');

const { processVideo } = require('./videoBuilder');
const fs = require('fs');

describe('videoBuilder', () => {
  let mockFfmpegObj;

  beforeEach(() => {
    vi.clearAllMocks();

    // Retrieve the globally injected mock object from vitest.setup.js
    mockFfmpegObj = global.__ffmpegMockObj;
    // Reset calls on the mock object
    if (mockFfmpegObj) {
      Object.values(mockFfmpegObj).forEach((fn) => {
        if (fn && fn.mockClear) fn.mockClear();
      });
    }

    if (fs.existsSync && fs.existsSync.mockReturnValue) {
      fs.existsSync.mockReturnValue(true);
    } else {
      fs.existsSync = vi.fn().mockReturnValue(true);
    }

    if (fs.unlinkSync && fs.unlinkSync.mockReturnValue) {
      fs.unlinkSync.mockReturnValue(true);
    } else {
      fs.unlinkSync = vi.fn().mockReturnValue(true);
    }

    if (fs.renameSync && fs.renameSync.mockReturnValue) {
      fs.renameSync.mockReturnValue(true);
    } else {
      fs.renameSync = vi.fn().mockReturnValue(true);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processes video without re-encode successfully', async () => {
    const strategy = {
      video: { action: 'copy', codec: 'copy' },
      audio: { action: 'copy', codec: 'copy' },
      subtitles: [],
    };

    const result = await processVideo('test.mkv', strategy, vi.fn());
    expect(result.success).toBe(true);
    expect(mockFfmpegObj.videoCodec).toHaveBeenCalledWith('copy');
    expect(mockFfmpegObj.audioCodec).toHaveBeenCalledWith('copy');
  });

  it('adds burn subtitle filter if strategy requires burn', async () => {
    const strategy = {
      video: { action: 'encode', codec: 'libx264', preset: 'slow' },
      audio: { action: 'copy', codec: 'copy' },
      subtitles: [{ action: 'burn', index: 2 }],
      externalSubtitle: 'ext.srt',
    };

    await processVideo('test.mkv', strategy, vi.fn());
    expect(mockFfmpegObj.videoFilters).toHaveBeenCalledWith(
      expect.stringContaining("subtitles='test.mkv':si=2")
    );
    expect(mockFfmpegObj.input).toHaveBeenCalledWith('ext.srt');
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-preset', 'slow');
  });

  it('adds soft_convert and external subtitles', async () => {
    const strategy = {
      video: { action: 'encode', codec: 'libx264' },
      audio: { action: 'copy', codec: 'copy' },
      subtitles: [
        { action: 'soft_convert', index: 1, language: 'eng', title: 'English' },
        { action: 'soft_convert', index: 2, language: 'fre' },
      ],
      externalSubtitle: 'ext.srt',
    };

    await processVideo('test.mkv', strategy, vi.fn());

    // Fast preset is default when action is encode
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-preset', 'fast');
    // soft_convert maps
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-map', '0:1');
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-metadata:s:s:0', 'title=English');
    // external maps
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-map', '1:0');
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-metadata:s:s:2', 'title=External');
    // fallback map
    expect(mockFfmpegObj.outputOptions).toHaveBeenCalledWith('-map', '0:v');
  });

  it('triggers progress callback', async () => {
    const strategy = { video: {}, audio: {}, subtitles: [] };

    mockFfmpegObj.run.mockImplementationOnce(function () {
      const progressCb = this.on.mock.calls.find((c) => c[0] === 'progress')?.[1];
      if (progressCb) progressCb({ percent: 50.123 });

      const endCb = this.on.mock.calls.find((c) => c[0] === 'end')?.[1];
      if (endCb) endCb();
      return this;
    });

    const onProgress = vi.fn();
    await processVideo('test.mkv', strategy, onProgress);
    expect(onProgress).toHaveBeenCalledWith('50.1');
  });

  it('handles progress callback without percent', async () => {
    const strategy = { video: {}, audio: {}, subtitles: [] };

    mockFfmpegObj.run.mockImplementationOnce(function () {
      const progressCb = this.on.mock.calls.find((c) => c[0] === 'progress')?.[1];
      if (progressCb) progressCb({}); // no percent

      const endCb = this.on.mock.calls.find((c) => c[0] === 'end')?.[1];
      if (endCb) endCb();
      return this;
    });

    const onProgress = vi.fn();
    await processVideo('test.mkv', strategy, onProgress);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('handles ffmpeg error', async () => {
    const strategy = { video: {}, audio: {}, subtitles: [] };

    mockFfmpegObj.run.mockImplementationOnce(function () {
      const errCb = this.on.mock.calls.find((c) => c[0] === 'error')?.[1];
      if (errCb) errCb(new Error('ffmpeg failed'));
      return this;
    });

    await expect(processVideo('test.mkv', strategy, vi.fn())).rejects.toThrow('ffmpeg failed');
    expect(fs.unlinkSync).toHaveBeenCalled(); // Should attempt to delete tempPath
  });

  it('handles fs errors during end callback', async () => {
    const strategy = { video: {}, audio: {}, subtitles: [] };

    fs.renameSync.mockImplementationOnce(() => {
      throw new Error('Rename failed');
    });

    await expect(processVideo('test.mkv', strategy, vi.fn())).rejects.toThrow('Rename failed');
  });

  it('handles false branches for fs checks and ignored subtitle actions', async () => {
    const strategy = {
      video: { action: 'copy', codec: 'copy' },
      audio: { action: 'copy', codec: 'copy' },
      subtitles: [
        { action: 'ignored_action', index: 1 }, // Hits the false branch of soft_convert check
      ],
    };

    fs.existsSync.mockReturnValue(false); // Make all existsSync checks return false

    await processVideo('test.mkv', strategy, vi.fn());

    // Ensure unlinkSync wasn't called because existsSync was false
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it('handles ffmpeg error when temp file does not exist', async () => {
    const strategy = { video: {}, audio: {}, subtitles: [] };

    mockFfmpegObj.run.mockImplementationOnce(function () {
      const errCb = this.on.mock.calls.find((c) => c[0] === 'error')?.[1];
      if (errCb) errCb(new Error('ffmpeg failed'));
      return this;
    });

    fs.existsSync.mockReturnValue(false);

    await expect(processVideo('test.mkv', strategy, vi.fn())).rejects.toThrow('ffmpeg failed');
    expect(fs.unlinkSync).not.toHaveBeenCalled(); // Should not attempt to delete tempPath
  });
});
