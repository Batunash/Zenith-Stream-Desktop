import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
const fs = require('fs');

const mockDb = {
    getEpisodeById: vi.fn(),
    updateWatchProgress: vi.fn()
};

// Inject into require.cache before requiring watchService
const mediaServicePath = require.resolve('./mediaService');
require.cache[mediaServicePath] = {
    id: mediaServicePath,
    filename: mediaServicePath,
    loaded: true,
    exports: { db: mockDb }
};

const { watch, updateProgress, getMimeType } = require('./watchService');

describe('Watch Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(fs, 'existsSync');
        vi.spyOn(fs, 'statSync');
        vi.spyOn(fs, 'createReadStream');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        delete require.cache[mediaServicePath];
    });

    describe('watch', () => {
        const mockReq = { params: { episodeId: '1' }, headers: {} };

        it('throws an error if episode not found in DB', () => {
            mockDb.getEpisodeById.mockReturnValue(null);
            expect(() => watch(mockReq)).toThrow('Episode not found in database');
        });

        it('throws an error if file not found on disk', () => {
            mockDb.getEpisodeById.mockReturnValue({ FILE_PATH: '/fake/path.mp4' });
            fs.existsSync.mockReturnValue(false);
            expect(() => watch(mockReq)).toThrow('File not found on disk');
        });

        it('handles full file request (no Range header)', () => {
            mockReq.headers = {};
            mockDb.getEpisodeById.mockReturnValue({ FILE_PATH: '/vid.mp4' });
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ size: 1000 });

            const result = watch(mockReq);

            expect(result).toEqual({
                filePath: '/vid.mp4',
                fileSize: 1000,
                headers: null
            });
        });

        it('handles partial file request (Range header present)', () => {
            mockReq.headers = { range: 'bytes=100-500' };
            mockDb.getEpisodeById.mockReturnValue({ FILE_PATH: '/vid.mp4' });
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ size: 1000 });
            const mockStream = {};
            fs.createReadStream.mockReturnValue(mockStream);

            const result = watch(mockReq);

            expect(fs.createReadStream).toHaveBeenCalledWith('/vid.mp4', { start: 100, end: 500 });
            expect(result.headers).toEqual({
                'Content-Type': 'video/mp4',
                'Content-Length': 401,
                'Content-Range': 'bytes 100-500/1000',
                'Accept-Ranges': 'bytes'
            });
            expect(result.file).toBe(mockStream);
        });
        
        it('handles Range header with no end byte', () => {
            mockReq.headers = { range: 'bytes=100-' };
            mockDb.getEpisodeById.mockReturnValue({ FILE_PATH: '/vid.mp4' });
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ size: 1000 });
            fs.createReadStream.mockReturnValue({});

            const result = watch(mockReq);

            expect(fs.createReadStream).toHaveBeenCalledWith('/vid.mp4', { start: 100, end: 999 });
            expect(result.headers['Content-Length']).toBe(900);
            expect(result.headers['Content-Range']).toBe('bytes 100-999/1000');
        });
    });

    describe('updateProgress', () => {
        it('calls db.updateWatchProgress and returns result', () => {
            mockDb.updateWatchProgress.mockReturnValue(true);
            const res = updateProgress(1, '10', 0.5, 120);
            expect(mockDb.updateWatchProgress).toHaveBeenCalledWith(1, '10', 0.5, 120);
            expect(res).toBe(true);
        });

        it('logs and throws error if DB fails', () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            mockDb.updateWatchProgress.mockImplementation(() => { throw new Error('DB Err'); });
            
            expect(() => updateProgress(1, '10', 0.5, 120)).toThrow('DB Err');
            expect(console.error).toHaveBeenCalledWith('Error updating watch progress:', expect.any(Error));
        });
    });

    describe('getMimeType', () => {
        it('returns correct mime type for known extensions', () => {
            expect(getMimeType('test.mkv')).toBe('video/x-matroska');
            expect(getMimeType('test.avi')).toBe('video/x-msvideo');
            expect(getMimeType('test.mp4')).toBe('video/mp4');
            expect(getMimeType('test.mov')).toBe('video/quicktime');
            expect(getMimeType('test.webm')).toBe('video/webm');
        });

        it('defaults to video/mp4 for unknown extensions', () => {
            expect(getMimeType('test.xyz')).toBe('video/mp4');
            expect(getMimeType('test')).toBe('video/mp4');
        });
        
        it('handles uppercase extensions correctly', () => {
            expect(getMimeType('test.MKV')).toBe('video/x-matroska');
        });
    });
});
