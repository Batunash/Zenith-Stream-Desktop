import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const registerServerControlIPC = require('./serverControl');
const { ipcMain } = require('electron');
const serverManager = require('../../backend/index');
const os = require('os');

vi.mock('../../backend/src/services/mediaService');

describe('serverControl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(serverManager, 'start').mockResolvedValue();
        vi.spyOn(serverManager, 'stop').mockResolvedValue();
        vi.spyOn(serverManager, 'isRunning').mockReturnValue(true);
        vi.spyOn(os, 'networkInterfaces').mockReturnValue({
            'Ethernet': [{ family: 'IPv4', internal: false, address: '192.168.1.10' }]
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers server:start and handles it', async () => {
        registerServerControlIPC();
        expect(ipcMain.handle).toHaveBeenCalledWith('server:start', expect.any(Function));
        
        const startHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:start')[1];
        const res = await startHandler();
        expect(serverManager.start).toHaveBeenCalled();
        expect(res.running).toBe(true);
    });

    it('handles server:start errors gracefully', async () => {
        registerServerControlIPC();
        const startHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:start')[1];
        serverManager.start.mockRejectedValue(new Error('Start failed'));
        
        const res = await startHandler();
        expect(res.running).toBe(false);
        expect(res.message).toBe('Start failed');
    });

    it('registers server:stop and handles it', async () => {
        registerServerControlIPC();
        const stopHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:stop')[1];
        serverManager.stop.mockResolvedValue();
        const res = await stopHandler();
        expect(serverManager.stop).toHaveBeenCalled();
        expect(res.running).toBe(false);
    });

    it('handles server:stop errors gracefully', async () => {
        registerServerControlIPC();
        const stopHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:stop')[1];
        serverManager.stop.mockRejectedValue(new Error('Stop failed'));
        const res = await stopHandler();
        expect(res.running).toBe(true);
        expect(res.message).toBe('Stop failed');
    });

    it('returns server:status correctly', async () => {
        registerServerControlIPC();
        const statusHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:status')[1];
        const res = await statusHandler();
        expect(res.running).toBe(true);
    });

    it('returns server:getNetworkInfo correctly', async () => {
        registerServerControlIPC();
        const networkHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:getNetworkInfo')[1];
        const res = await networkHandler();
        expect(res.ip).toBe('192.168.1.10');
    });

    it('returns 127.0.0.1 if getNetworkInfo throws', async () => {
        registerServerControlIPC();
        os.networkInterfaces.mockImplementation(() => { throw new Error('Crash'); });
        const networkHandler = ipcMain.handle.mock.calls.find(c => c[0] === 'server:getNetworkInfo')[1];
        const res = await networkHandler();
        expect(res.ip).toBe('127.0.0.1');
    });
});
