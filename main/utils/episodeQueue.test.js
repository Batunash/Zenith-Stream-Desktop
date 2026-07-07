import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import EventEmitter from 'events';

// episodeQueue.js uses:  const fs = require('fs')  → gets global.__fsMock (Module.prototype.require intercept)
// The test MUST use global.__fsMock (not `import fs from 'fs'` which gives the real Node fs)
const EpisodeQueue = require('./episodeQueue');

describe('EpisodeQueue', () => {
  let queue;
  let fs;

  beforeEach(() => {
    vi.clearAllMocks();
    fs = global.__fsMock;

    // Default safe state
    fs.statSync.mockReturnValue({ size: 100 });
    fs.existsSync.mockReturnValue(true);
    fs.unlink.mockImplementation((_src, cb) => cb(null));
    fs.mkdirSync.mockImplementation(() => {});

    queue = new EpisodeQueue('/mock/media', 2);
  });

  it('adds videos and processes them', async () => {
    const mockEvent = { sender: { send: vi.fn() } };

    const readStream = new EventEmitter();
    readStream.pipe = vi.fn();
    const writeStream = new EventEmitter();

    fs.createReadStream.mockReturnValue(readStream);
    fs.createWriteStream.mockReturnValue(writeStream);

    queue.addVideos([
      { filePath: '/mock/src1.mkv', destFolder: '/mock/dest1', event: mockEvent },
      { filePath: '/mock/src2.mkv', destFolder: '/mock/dest2', event: mockEvent },
    ]);

    expect(queue.activeCount).toBe(2);

    // Simulate copy progress
    readStream.emit('data', { length: 50 });
    expect(mockEvent.sender.send).toHaveBeenCalledWith('file:addEpisode:progress', {
      file: '/mock/src1.mkv',
      percent: 50,
    });

    // Simulate copy finish
    writeStream.emit('finish');
    await new Promise(process.nextTick);

    expect(mockEvent.sender.send).toHaveBeenCalledWith('file:addEpisode:done', {
      file: '/mock/src1.mkv',
      path: path.join('/mock/dest1', 'src1.mkv'),
    });
    expect(fs.unlink).toHaveBeenCalledWith('/mock/src1.mkv', expect.any(Function));
  });

  it('handles fs.unlink failure gracefully', async () => {
    const mockEvent = { sender: { send: vi.fn() } };
    const readStream = new EventEmitter();
    readStream.pipe = vi.fn();
    const writeStream = new EventEmitter();

    fs.createReadStream.mockReturnValue(readStream);
    fs.createWriteStream.mockReturnValue(writeStream);
    fs.unlink.mockImplementation((_src, cb) => cb(new Error('Unlink error')));

    queue.addVideos([{ filePath: '/mock/src1.mkv', destFolder: '/mock/dest1', event: mockEvent }]);

    writeStream.emit('finish');
    await new Promise(process.nextTick);

    // Still sends done even if unlink failed (file was copied)
    expect(mockEvent.sender.send).toHaveBeenCalledWith('file:addEpisode:done', {
      file: '/mock/src1.mkv',
      path: path.join('/mock/dest1', 'src1.mkv'),
    });
  });

  it('creates destFolder if it does not exist', () => {
    const mockEvent = { sender: { send: vi.fn() } };
    fs.existsSync.mockReturnValue(false);
    const readStream = new EventEmitter();
    readStream.pipe = vi.fn();
    const writeStream = new EventEmitter();
    fs.createReadStream.mockReturnValue(readStream);
    fs.createWriteStream.mockReturnValue(writeStream);

    queue.addVideos([{ filePath: '/mock/src1.mkv', destFolder: '/mock/dest1', event: mockEvent }]);

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/dest1', { recursive: true });
  });

  it('handles mkdirSync permission error gracefully without crashing', async () => {
    const mockEvent = { sender: { send: vi.fn() } };
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    queue.addVideos([{ filePath: '/mock/src1.mkv', destFolder: '/mock/dest1', event: mockEvent }]);

    await new Promise(process.nextTick);

    expect(mockEvent.sender.send).toHaveBeenCalledWith('file:addEpisode:done', {
      file: '/mock/src1.mkv',
      error: 'EACCES: permission denied',
    });
  });

  it('handles writeStream error (e.g. disk full) gracefully', async () => {
    const mockEvent = { sender: { send: vi.fn() } };
    const readStream = new EventEmitter();
    readStream.pipe = vi.fn();
    const writeStream = new EventEmitter();

    fs.createReadStream.mockReturnValue(readStream);
    fs.createWriteStream.mockReturnValue(writeStream);

    queue.addVideos([{ filePath: '/mock/src1.mkv', destFolder: '/mock/dest1', event: mockEvent }]);

    // Simulate disk full — caught by write.on('error', reject)
    writeStream.emit('error', new Error('ENOSPC: no space left on device'));

    await new Promise(process.nextTick);

    expect(mockEvent.sender.send).toHaveBeenCalledWith('file:addEpisode:done', {
      file: '/mock/src1.mkv',
      error: 'ENOSPC: no space left on device',
    });
    expect(queue.activeCount).toBeLessThan(2);
  });
});
