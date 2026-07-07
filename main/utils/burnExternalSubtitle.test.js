import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a stable ffmpeg mock BEFORE burnExternalSubtitle.js is required.
// burnExternalSubtitle.js does: const ffmpeg = require('./ffmpegHelper')
// We inject into require.cache so it gets this stable vi.fn() instead of the real module.
const ffmpegMock = vi.hoisted(() => vi.fn());

vi.mock('./ffmpegHelper', () => ({ default: ffmpegMock }));

// Manual require.cache injection for CJS interop
const _p              = require('path');
const _ffmpegHelperPath = _p.resolve(process.cwd(), 'main/utils/ffmpegHelper.js');
require.cache[_ffmpegHelperPath] = {
    id: _ffmpegHelperPath, filename: _ffmpegHelperPath, loaded: true,
    exports: ffmpegMock, children: [], paths: []
};

// CJS require AFTER injection — burnExternalSubtitle.js will find our mock in cache
const { burnExternalSrt } = require('./burnExternalSubtitle');

describe('burnExternalSubtitle', () => {
    let mockFfmpegChain;
    let fs;

    beforeEach(() => {
        vi.clearAllMocks();
        fs = global.__fsMock;

        mockFfmpegChain = {
            videoCodec:    vi.fn().mockReturnThis(),
            audioCodec:    vi.fn().mockReturnThis(),
            outputOptions: vi.fn().mockReturnThis(),
            videoFilters:  vi.fn().mockReturnThis(),
            output:        vi.fn().mockReturnThis(),
            on:            vi.fn().mockReturnThis(),
            run:           vi.fn()
        };

        ffmpegMock.mockReturnValue(mockFfmpegChain);
    });

    it('successfully burns subtitle, fires progress, renames temp file', async () => {
        mockFfmpegChain.on.mockImplementation((event, callback) => {
            if (event === 'progress') callback({ percent: 50 });
            if (event === 'end') callback();
            return mockFfmpegChain;
        });

        fs.existsSync.mockReturnValue(true);
        fs.unlinkSync.mockImplementation(() => {});
        fs.renameSync.mockImplementation(() => {});

        const onProgress = vi.fn();
        const promise = burnExternalSrt('/path/to/video.mp4', '/path/to/sub.srt', onProgress);
        await new Promise(r => setTimeout(r, 10));
        const result = await promise;

        expect(ffmpegMock).toHaveBeenCalledWith('/path/to/video.mp4');
        expect(mockFfmpegChain.videoFilters).toHaveBeenCalledWith(expect.stringContaining('subtitles='));
        expect(mockFfmpegChain.run).toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalledWith('50.0');
        expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/video.mp4');
        expect(fs.renameSync).toHaveBeenCalled();
        expect(result).toEqual({ success: true, path: '/path/to/video.mp4' });
    });

    it('rejects and cleans up temp file on ffmpeg error', async () => {
        mockFfmpegChain.on.mockImplementation((event, callback) => {
            if (event === 'error') callback(new Error('ffmpeg crash'));
            return mockFfmpegChain;
        });

        fs.existsSync.mockReturnValue(true);
        fs.unlinkSync.mockImplementation(() => {});

        await expect(burnExternalSrt('/path/to/video.mp4', '/path/to/sub.srt')).rejects.toThrow('ffmpeg crash');
        expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('rejects if fs.renameSync throws', async () => {
        mockFfmpegChain.on.mockImplementation((event, callback) => {
            if (event === 'end') callback();
            return mockFfmpegChain;
        });

        fs.existsSync.mockReturnValue(false);
        fs.renameSync.mockImplementation(() => { throw new Error('EPERM'); });

        await expect(burnExternalSrt('/path/to/video.mp4', '/path/to/sub.srt')).rejects.toThrow('EPERM');
    });

    it('does not throw if cleanup during error fails', async () => {
        mockFfmpegChain.on.mockImplementation((event, callback) => {
            if (event === 'error') callback(new Error('crash'));
            return mockFfmpegChain;
        });

        fs.existsSync.mockReturnValue(true);
        fs.unlinkSync.mockImplementation(() => { throw new Error('locked'); });

        await expect(burnExternalSrt('/path/to/video.mp4', '/path/to/sub.srt')).rejects.toThrow('crash');
    });
});
