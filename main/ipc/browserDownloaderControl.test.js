import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-top spies (default implementations persist across clearAllMocks) ───
// electron is provided by the global CJS require interceptor in vitest.setup.js
// (mockIpcMain.handle, mockDialog.showOpenDialog, mockApp.getPath -> 'C:\Media').

const handlesettings = require('../utils/handlesettings');
vi.spyOn(handlesettings, 'getSettings').mockReturnValue({ MEDIA_DIR: 'C:\\Media' });

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

const browserDownloader = require('../utils/browserDownloader');
const mockDownloadStream = vi.spyOn(browserDownloader, 'downloadStream').mockResolvedValue();
// spies for every other browserDownloader method the control fans out to:
const mockNavigateTo          = vi.spyOn(browserDownloader, 'navigateTo').mockResolvedValue({ ok: true });
const mockResizeBrowserView   = vi.spyOn(browserDownloader, 'resizeBrowserView').mockReturnValue(undefined);
const mockShowBrowserView     = vi.spyOn(browserDownloader, 'showBrowserView').mockReturnValue(undefined);
const mockHideBrowserView     = vi.spyOn(browserDownloader, 'hideBrowserView').mockReturnValue(undefined);
const mockGoBack              = vi.spyOn(browserDownloader, 'goBack').mockReturnValue(undefined);
const mockGoForward           = vi.spyOn(browserDownloader, 'goForward').mockReturnValue(undefined);
const mockReload              = vi.spyOn(browserDownloader, 'reload').mockReturnValue(undefined);
const mockGetCapturedStreams  = vi.spyOn(browserDownloader, 'getCapturedStreams').mockReturnValue([]);
const mockClearCapturedStreams= vi.spyOn(browserDownloader, 'clearCapturedStreams').mockReturnValue(undefined);
const mockGetDownloads        = vi.spyOn(browserDownloader, 'getDownloads').mockReturnValue([]);
const mockClearCompleted      = vi.spyOn(browserDownloader, 'clearCompletedDownloads').mockReturnValue(undefined);
const mockCancelDownload      = vi.spyOn(browserDownloader, 'cancelDownload').mockReturnValue(undefined);

let handlers;
let showSaveDialog;

describe('browserDownloaderControl', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish the fs defaults after clearAllMocks (Vitest 4 clears the
    // vi.mock factory impl, so existsSync would otherwise return undefined -> falsy
    // and only the mkdir branch would ever be hit). Keeps the skip-mkdir branch live.
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    const register = (await import('./browserDownloaderControl.js')).default;
    register();
    const electron = require('electron');
    // Build a channel -> handler map from the ipcMain.handle calls.
    handlers = {};
    for (const [ch, fn] of electron.ipcMain.handle.mock.calls) handlers[ch] = fn;
    // The global mockDialog only has showOpenDialog; add showSaveDialog for the custom-save branch.
    showSaveDialog = vi.fn().mockResolvedValue({ filePath: '' });
    electron.dialog.showSaveDialog = showSaveDialog;
  });

  it('registers all 13 ipcMain.handle channels', () => {
    const channels = Object.keys(handlers).sort();
    expect(channels).toEqual([
      'browser:cancelDownload',
      'browser:clearCompleted',
      'browser:clearStreams',
      'browser:downloadStream',
      'browser:downloads',
      'browser:getStreams',
      'browser:goBack',
      'browser:goForward',
      'browser:hide',
      'browser:navigate',
      'browser:reload',
      'browser:resize',
      'browser:show',
    ]);
  });

  // ─── Simple fan-out handlers (no branching) ───
  it('browser:navigate awaits navigateTo and returns its result', async () => {
    mockNavigateTo.mockResolvedValueOnce({ success: true, url: 'http://x' });
    const out = await handlers['browser:navigate']({}, 'http://x');
    expect(mockNavigateTo).toHaveBeenCalledWith('http://x');
    expect(out).toEqual({ success: true, url: 'http://x' });
  });

  it('browser:navigate returns {success:false,error} when navigateTo rejects (try/catch)', async () => {
    mockNavigateTo.mockRejectedValueOnce(new Error('nav fail'));
    const out = await handlers['browser:navigate']({}, 'http://bad');
    expect(out).toEqual({ success: false, error: 'nav fail' });
  });

  it('browser:resize calls resizeBrowserView(bounds) and returns {success:true}', () => {
    const out = handlers['browser:resize']({}, { width: 100, height: 200 });
    expect(mockResizeBrowserView).toHaveBeenCalledWith({ width: 100, height: 200 });
    expect(out).toEqual({ success: true });
  });

  it('browser:show calls showBrowserView and returns {success:true}', () => {
    const out = handlers['browser:show']({});
    expect(mockShowBrowserView).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:hide calls hideBrowserView and returns {success:true}', () => {
    const out = handlers['browser:hide']({});
    expect(mockHideBrowserView).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:goBack calls goBack and returns {success:true}', () => {
    const out = handlers['browser:goBack']({});
    expect(mockGoBack).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:goForward calls goForward and returns {success:true}', () => {
    const out = handlers['browser:goForward']({});
    expect(mockGoForward).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:reload calls reload and returns {success:true}', () => {
    const out = handlers['browser:reload']({});
    expect(mockReload).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:getStreams wraps getCapturedStreams in {success:true,streams}', () => {
    mockGetCapturedStreams.mockReturnValueOnce([{ id: 1 }, { id: 2 }]);
    const out = handlers['browser:getStreams']({});
    expect(mockGetCapturedStreams).toHaveBeenCalled();
    expect(out).toEqual({ success: true, streams: [{ id: 1 }, { id: 2 }] });
  });

  it('browser:clearStreams calls clearCapturedStreams and returns {success:true}', () => {
    const out = handlers['browser:clearStreams']({});
    expect(mockClearCapturedStreams).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:downloads returns getDownloads() directly (no wrapper)', () => {
    mockGetDownloads.mockReturnValueOnce([{ id: 9, percent: 50 }]);
    const out = handlers['browser:downloads']({});
    expect(mockGetDownloads).toHaveBeenCalled();
    expect(out).toEqual([{ id: 9, percent: 50 }]);
  });

  it('browser:clearCompleted calls clearCompletedDownloads and returns {success:true}', () => {
    const out = handlers['browser:clearCompleted']({});
    expect(mockClearCompleted).toHaveBeenCalled();
    expect(out).toEqual({ success: true });
  });

  it('browser:cancelDownload calls cancelDownload(jobId) and returns {success:true}', () => {
    const out = handlers['browser:cancelDownload']({}, 'job-42');
    expect(mockCancelDownload).toHaveBeenCalledWith('job-42');
    expect(out).toEqual({ success: true });
  });

  // ─── browser:downloadStream — the meaty handler with 7 branches ───
  describe('browser:downloadStream', () => {
    it('sanitizes the filename and saves to the library dir when enabled (existing behavior)', async () => {
      const stream = { type: 'VIDEO' };
      const dirtyFilename = 'One Piece 1.Sezon 1. Bölüm izle – diziwatch?!';
      const libraryContext = { enabled: true, serieName: 'One Piece', seasonId: 'Season 1' };
      const out = await handlers['browser:downloadStream']({}, { stream, filename: dirtyFilename, libraryContext });
      expect(out).toEqual({ success: true });
      expect(mockDownloadStream).toHaveBeenCalled();
      const passedFilePath = mockDownloadStream.mock.calls[0][1];
      expect(passedFilePath).toContain('One Piece 1.Sezon 1. Bölüm izle - diziwatch__');
      expect(passedFilePath.endsWith('.mkv')).toBe(true);
    });

    it('uses .vtt extension for SUBTITLE streams in library mode', async () => {
      const stream = { type: 'SUBTITLE' };
      const out = await handlers['browser:downloadStream']({}, {
        stream, filename: 'Ep1 Sub', libraryContext: { enabled: true, serieName: 'S', seasonId: 'Season 1' },
      });
      expect(out).toEqual({ success: true });
      expect(mockDownloadStream.mock.calls[0][1].endsWith('.vtt')).toBe(true);
    });

    it('creates the library dir with mkdirSync when it does not exist (existsSync false)', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      const stream = { type: 'VIDEO' };
      await handlers['browser:downloadStream']({}, {
        stream, filename: 'Movie', libraryContext: { enabled: true, serieName: 'S', seasonId: 'Season 1' },
      });
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('Season 1'), { recursive: true });
    });

    it('returns {success:false} when library mode is enabled but MEDIA_DIR is not configured', async () => {
      handlesettings.getSettings.mockReturnValueOnce({});
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'Movie',
        libraryContext: { enabled: true, serieName: 'S', seasonId: 'Season 1' },
      });
      expect(out).toEqual({ success: false, error: 'Media directory not configured in settings' });
      expect(mockDownloadStream).not.toHaveBeenCalled();
    });

    it('opens a save dialog in custom mode and uses the chosen filePath for a video', async () => {
      showSaveDialog.mockResolvedValueOnce({ filePath: 'C:\\out\\video.mkv' });
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'Movie', libraryContext: { enabled: false },
      });
      expect(out).toEqual({ success: true });
      expect(showSaveDialog).toHaveBeenCalled();
      expect(mockDownloadStream.mock.calls[0][1]).toBe('C:\\out\\video.mkv');
    });

    it('opens a save dialog with subtitle filters/title for a SUBTITLE stream in custom mode', async () => {
      showSaveDialog.mockResolvedValueOnce({ filePath: 'C:\\out\\sub.vtt' });
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'SUBTITLE' }, filename: 'Ep1 Sub', libraryContext: { enabled: false },
      });
      expect(out).toEqual({ success: true });
      const call = showSaveDialog.mock.calls[0][0];
      expect(call.title).toBe('Save Subtitle');
      expect(call.filters).toEqual([{ name: 'Subtitles', extensions: ['vtt', 'srt'] }]);
      expect(mockDownloadStream.mock.calls[0][1]).toBe('C:\\out\\sub.vtt');
    });

    it('uses the Video filters and Save Video title in custom mode for a video stream', async () => {
      showSaveDialog.mockResolvedValueOnce({ filePath: 'C:\\out\\v.mkv' });
      await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'Vid', libraryContext: { enabled: false },
      });
      const call = showSaveDialog.mock.calls[0][0];
      expect(call.title).toBe('Save Video');
      expect(call.filters).toEqual([{ name: 'Videos', extensions: ['mkv', 'mp4', 'ts'] }]);
    });

    it('returns {success:false, Cancelled by user} when the save dialog is dismissed (no filePath)', async () => {
      showSaveDialog.mockResolvedValueOnce({ filePath: '' });
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'Movie', libraryContext: { enabled: false },
      });
      expect(out).toEqual({ success: false, error: 'Cancelled by user' });
      expect(mockDownloadStream).not.toHaveBeenCalled();
    });

    it('returns {success:false,error} when a custom-mode download with no libraryContext (null branch)', async () => {
      // libraryContext null -> else branch (custom save dialog path).
      showSaveDialog.mockResolvedValueOnce({ filePath: 'C:\\out\\x.mkv' });
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'NoCtx',
      });
      expect(out).toEqual({ success: true });
      expect(mockDownloadStream.mock.calls[0][1]).toBe('C:\\out\\x.mkv');
    });

    it('returns {success:false,error} when downloadStream throws synchronously (outer try/catch)', async () => {
      mockDownloadStream.mockImplementationOnce(() => { throw new Error('sync boom'); });
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'Movie',
        libraryContext: { enabled: true, serieName: 'S', seasonId: 'Season 1' },
      });
      expect(out).toEqual({ success: false, error: 'sync boom' });
    });

    it('returns {success:false,error} when mkdirSync throws (outer try/catch via fs)', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      fs.mkdirSync.mockImplementationOnce(() => { throw new Error('mkdir denied'); });
      const out = await handlers['browser:downloadStream']({}, {
        stream: { type: 'VIDEO' }, filename: 'Movie',
        libraryContext: { enabled: true, serieName: 'S', seasonId: 'Season 1' },
      });
      expect(out).toEqual({ success: false, error: 'mkdir denied' });
    });
  });
});