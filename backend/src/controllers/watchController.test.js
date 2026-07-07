import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock objects BEFORE any require() runs
const watchMocks = vi.hoisted(() => ({
    watch:          vi.fn(),
    getMimeType:    vi.fn(),
    updateProgress: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
    getEpisodeById: vi.fn()
}));

// Also register with vitest's system (for ESM paths)
vi.mock('../services/watchService', () => ({ ...watchMocks }));
vi.mock('../config/database',       () => ({ ...dbMocks }));

// ─── Manual require.cache injection ─────────────────────────────────────────
// vi.mock only injects into vitest's module registry.
// watchController.js uses CJS require() → hits Node's require.cache directly.
// We must inject into require.cache with the exact Windows absolute path BEFORE
// require('./watchController') runs.
const _nodePath = require('path');
const _cwd = process.cwd(); // c:\Zenith\Zenith-Stream-Desktop

const _watchSvcPath = _nodePath.resolve(_cwd, 'backend/src/services/watchService.js');
const _dbPath       = _nodePath.resolve(_cwd, 'backend/src/config/database.js');

require.cache[_watchSvcPath] = { id: _watchSvcPath, filename: _watchSvcPath, loaded: true, exports: watchMocks, children: [], paths: [] };
require.cache[_dbPath]       = { id: _dbPath,       filename: _dbPath,       loaded: true, exports: dbMocks,    children: [], paths: [] };
// ────────────────────────────────────────────────────────────────────────────

const { startWatch, updateProgress, downloadEpisode } = require('./watchController');

describe('Watch Controller', () => {
    let mockReq;
    let mockRes;
    let fs;

    beforeEach(() => {
        vi.clearAllMocks();
        fs = global.__fsMock;

        mockReq = {
            params: { episodeId: 1 },
            body:   { progress: 0.5, watchTime: 120 },
            user:   { id: 1 },
            headers: {}
        };
        mockRes = {
            status:      vi.fn().mockReturnThis(),
            set:         vi.fn(),
            json:        vi.fn(),
            download:    vi.fn(),
            headersSent: false
        };
    });

    describe('startWatch', () => {
        it('handles streaming with range header correctly (206)', async () => {
            const mockStream = { pipe: vi.fn() };
            watchMocks.watch.mockReturnValueOnce({
                headers: { 'Content-Range': 'bytes 0-100/1000' },
                file: mockStream
            });

            await startWatch(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(206);
            expect(mockRes.set).toHaveBeenCalledWith({ 'Content-Range': 'bytes 0-100/1000' });
            expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
        });

        it('handles full file streaming correctly (200)', async () => {
            watchMocks.watch.mockReturnValueOnce({ filePath: '/video.mp4', fileSize: 1000 });
            watchMocks.getMimeType.mockReturnValueOnce('video/mp4');
            const mockStream = { pipe: vi.fn() };
            fs.createReadStream.mockReturnValueOnce(mockStream);

            await startWatch(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.set).toHaveBeenCalledWith({
                'Content-Type':   'video/mp4',
                'Content-Length': 1000,
                'Accept-Ranges':  'bytes'
            });
            expect(fs.createReadStream).toHaveBeenCalledWith('/video.mp4');
            expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
        });

        it('handles errors in startWatch', async () => {
            watchMocks.watch.mockImplementationOnce(() => { throw new Error('Not found'); });

            await startWatch(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' });
        });
    });

    describe('updateProgress', () => {
        it('returns 401 if user not authenticated', async () => {
            delete mockReq.user;
            await updateProgress(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('updates progress successfully', async () => {
            await updateProgress(mockReq, mockRes);
            expect(watchMocks.updateProgress).toHaveBeenCalledWith(1, 1, 0.5, 120);
            expect(mockRes.json).toHaveBeenCalledWith({ success: true });
        });

        it('handles errors gracefully', async () => {
            watchMocks.updateProgress.mockImplementationOnce(() => { throw new Error('DB Error'); });
            await updateProgress(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'PROGRESS_UPDATE_FAILED' });
        });
    });

    describe('downloadEpisode', () => {
        it('returns 404 if episode not found in DB', async () => {
            dbMocks.getEpisodeById.mockReturnValueOnce(null);
            await downloadEpisode(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Episode not found' });
        });

        it('returns 404 if file does not exist', async () => {
            dbMocks.getEpisodeById.mockReturnValueOnce({ FILE_PATH: '/invalid.mp4' });
            fs.existsSync.mockReturnValueOnce(false);
            await downloadEpisode(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'File not found' });
        });

        it('downloads file with safe name', async () => {
            dbMocks.getEpisodeById.mockReturnValueOnce({
                FILE_PATH:      '/valid.mp4',
                SEASON_ID:      1,
                EPISODE_NUMBER: 2,
                NAME:           'Test Episode!'
            });
            fs.existsSync.mockReturnValueOnce(true);
            await downloadEpisode(mockReq, mockRes);
            expect(mockRes.download).toHaveBeenCalledWith('/valid.mp4', 'S1E2_Test_Episode_.mp4');
        });

        it('handles exceptions in download', async () => {
            dbMocks.getEpisodeById.mockImplementationOnce(() => { throw new Error('Crash'); });
            await downloadEpisode(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'DOWNLOAD_FAILED' });
        });
    });
});
