import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fs = require('fs');
const { ipcMain } = require('electron');
const handlesettings = require('../utils/handlesettings');
vi.mock('../utils/subtitleTranslator');
const translator = require('../utils/subtitleTranslator');

const registerTranslateControl = require('./translateControl');

describe('translateControl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(handlesettings, 'getSettings').mockReturnValue({ NVIDIA_API_KEY: 'test-key', AI_PROVIDER: 'nvidia' });
        
        
        if (translator.extractSubtitleToSrt.mockResolvedValue) {
            translator.extractSubtitleToSrt.mockResolvedValue('1\n00:00:01,000 --> 00:00:02,000\nHello\n');
        } else {
            translator.extractSubtitleToSrt = vi.fn().mockResolvedValue('1\n00:00:01,000 --> 00:00:02,000\nHello\n');
        }
        
        if (translator.translateSrt.mockImplementation) {
            translator.translateSrt.mockImplementation(async (srt, lang, provider, key, onProgress) => {
                onProgress({ stage: 'translate', percent: 50 });
                return '1\n00:00:01,000 --> 00:00:02,000\nMerhaba\n';
            });
        } else {
            translator.translateSrt = vi.fn().mockImplementation(async (srt, lang, provider, key, onProgress) => {
                onProgress({ stage: 'translate', percent: 50 });
                return '1\n00:00:01,000 --> 00:00:02,000\nMerhaba\n';
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers translate IPC handler', () => {
        registerTranslateControl();
        const calls = ipcMain.handle.mock.calls.map(c => c[0]);
        expect(calls).toContain('media:translateSubtitle');
    });

    it('fails if videoPath is missing or missing from fs', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        const res1 = await handler({}, { streamIndex: 1, targetLang: 'tr' });
        expect(res1.success).toBe(false);
        expect(res1.code).toBe('NO_VIDEO');
        
        fs.existsSync.mockReturnValue(false);
        const res2 = await handler({}, { videoPath: 'test.mkv', streamIndex: 1, targetLang: 'tr' });
        expect(res2.success).toBe(false);
        expect(res2.code).toBe('NO_VIDEO');
    });

    it('fails if streamIndex is missing', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        const result = await handler({}, { videoPath: 'test.mkv', targetLang: 'tr' });
        expect(result.success).toBe(false);
        expect(result.code).toBe('NO_STREAM');
    });

    it('fails if targetLang is missing', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        const result = await handler({}, { videoPath: 'test.mkv', streamIndex: 1 });
        expect(result.success).toBe(false);
        expect(result.code).toBe('NO_TARGET');
    });

    it('fails if API key is missing', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        handlesettings.getSettings.mockReturnValue({ AI_PROVIDER: 'nvidia' });
        
        const result = await handler({}, { videoPath: 'test.mkv', streamIndex: 1, targetLang: 'tr' });
        expect(result.success).toBe(false);
        expect(result.code).toBe('NO_KEY');
    });

    it('translates successfully and saves srt', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        const event = { sender: { send: vi.fn() } };
        const result = await handler(event, { videoPath: 'test.mkv', streamIndex: 1, targetLang: 'tr' });
        
        expect(result.success).toBe(true);
        expect(result.srtPath).toMatch(/test\.tr\.srt$/);
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(translator.extractSubtitleToSrt).toHaveBeenCalled();
        expect(translator.translateSrt).toHaveBeenCalled();
    });

    it('handles translation errors gracefully', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        translator.extractSubtitleToSrt.mockRejectedValue(new Error('Extract error'));
        const event = { sender: { send: vi.fn() } };
        
        const result = await handler(event, { videoPath: 'test.mkv', streamIndex: 1, targetLang: 'tr' });
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('UNKNOWN');
        expect(result.error).toBe('Extract error');
    });

    it('gracefully handles external API rate limits (e.g., 429 Too Many Requests)', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        translator.extractSubtitleToSrt.mockResolvedValue('1\n00:00:01,000 --> 00:00:02,000\nHello\n');
        translator.translateSrt.mockRejectedValue(new Error('Request failed with status code 429'));
        
        const event = { sender: { send: vi.fn() } };
        const result = await handler(event, { videoPath: 'test.mkv', streamIndex: 1, targetLang: 'tr' });
        
        expect(result.success).toBe(false);
        // It shouldn't crash, it should return the error string.
        expect(result.error).toContain('429');
    });

    it('gracefully handles external API timeouts', async () => {
        registerTranslateControl();
        const handler = ipcMain.handle.mock.calls.find(c => c[0] === 'media:translateSubtitle')[1];
        
        translator.extractSubtitleToSrt.mockResolvedValue('1\n00:00:01,000 --> 00:00:02,000\nHello\n');
        translator.translateSrt.mockRejectedValue(new Error('timeout of 10000ms exceeded'));
        
        const event = { sender: { send: vi.fn() } };
        const result = await handler(event, { videoPath: 'test.mkv', streamIndex: 1, targetLang: 'tr' });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
    });
});
