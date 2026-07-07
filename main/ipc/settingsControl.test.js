import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const handleSettings = require('../utils/handlesettings');
const db = require('../../backend/src/config/database');
const { ipcMain, app } = require('electron');

const registerSettingsControl = require('./settingsControl');

describe('settingsControl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        vi.spyOn(handleSettings, 'getSettings').mockReturnValue({});
        vi.spyOn(handleSettings, 'saveSettings').mockImplementation(() => {});
        vi.spyOn(handleSettings, 'moveArchiveContents').mockImplementation(() => {});
        
        vi.spyOn(db, 'syncFilesystemToDatabase').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns settings on settings:get', async () => {
        registerSettingsControl();
        const getHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'settings:get')[1];
        handleSettings.getSettings.mockReturnValue({ PORT: 3000 });
        const res = await getHandler();
        expect(res).toEqual({ PORT: 3000 });
    });

    it('saves settings and moves archive if path changed', async () => {
        registerSettingsControl();
        const saveHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'settings:save')[1];
        
        handleSettings.getSettings.mockReturnValue({ MEDIA_DIR: '/old/path' });
        
        const newConfig = { MEDIA_DIR: '/new/path', PORT: 4000 };
        const res = await saveHandler({}, newConfig);
        
        expect(handleSettings.moveArchiveContents).toHaveBeenCalledWith('/old/path', '/new/path');
        expect(handleSettings.saveSettings).toHaveBeenCalledWith(newConfig);
        expect(db.syncFilesystemToDatabase).toHaveBeenCalledWith('/new/path', expect.any(Array));
        expect(res.success).toBe(true);
    });

    it('restarts app on app:restart', () => {
        registerSettingsControl();
        const restartHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'app:restart')[1];
        restartHandler();
        expect(app.relaunch).toHaveBeenCalled();
        expect(app.exit).toHaveBeenCalled();
    });

    it('handles errors gracefully on settings:save', async () => {
        registerSettingsControl();
        const saveHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'settings:save')[1];
        
        handleSettings.getSettings.mockImplementation(() => { throw new Error('File System Error'); });
        
        const newConfig = { MEDIA_DIR: '/new/path', PORT: 4000 };
        const res = await saveHandler({}, newConfig);
        
        expect(res.success).toBe(false);
        expect(res.error).toBe('File System Error');
    });
});

