import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMain, dialog } = require('electron');
const fs = require('fs');

const registerDialogManager = require('./dialogManager');

describe('dialogManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        vi.spyOn(dialog, 'showOpenDialog').mockResolvedValue({ canceled: true, filePaths: [] });
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers dialog IPC handlers', () => {
        registerDialogManager();
        const calls = ipcMain.handle.mock.calls.map(c => c[0]);
        expect(calls).toContain('dialog:openVideoFiles');
        expect(calls).toContain('dialog:openFileImage');
        expect(calls).toContain('dialog:openDirectory');
        expect(calls).toContain('dialog:openSubtitleFile');
        expect(calls).toContain('dialog:listDirectory');
    });

    describe('dialog:openVideoFiles', () => {
        it('returns empty array if canceled', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:openVideoFiles')[1];
            
            const result = await handler({}, {});
            expect(result).toEqual([]);
        });

        it('returns filePaths if not canceled', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:openVideoFiles')[1];
            
            dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['video1.mkv', 'video2.mkv'] });
            const result = await handler({}, {});
            expect(result).toEqual(['video1.mkv', 'video2.mkv']);
        });
    });

    describe('dialog:openFileImage', () => {
        it('returns null if canceled', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:openFileImage')[1];
            
            const result = await handler();
            expect(result).toBeNull();
        });

        it('returns first filePath if not canceled', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:openFileImage')[1];
            
            dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['image.jpg'] });
            const result = await handler();
            expect(result).toBe('image.jpg');
        });
    });

    describe('dialog:openDirectory', () => {
        it('returns first filePath if not canceled', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:openDirectory')[1];
            
            dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:\\Media'] });
            const result = await handler();
            expect(result).toBe('C:\\Media');
        });
    });

    describe('dialog:openSubtitleFile', () => {
        it('returns first filePath if not canceled', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:openSubtitleFile')[1];
            
            dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['test.srt'] });
            const result = await handler();
            expect(result).toBe('test.srt');
        });
    });

    describe('dialog:listDirectory', () => {
        it('returns empty array if dirPath is missing or does not exist', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:listDirectory')[1];
            
            const result1 = await handler({}, null);
            expect(result1).toEqual([]);
            
            fs.existsSync.mockReturnValue(false);
            const result2 = await handler({}, 'C:\\missing');
            expect(result2).toEqual([]);
        });

        it('returns list of files if dirPath exists', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:listDirectory')[1];
            
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue([
                { name: 'file1.txt', isFile: () => true, size: 100 },
                { name: 'dir1', isFile: () => false }
            ]);
            
            const result = await handler({}, 'C:\\Media');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('file1.txt');
        });

        it('handles errors and returns empty array', async () => {
            registerDialogManager();
            const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'dialog:listDirectory')[1];
            
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockImplementation(() => { throw new Error('fs error'); });
            
            const result = await handler({}, 'C:\\Media');
            expect(result).toEqual([]);
        });
    });
});
