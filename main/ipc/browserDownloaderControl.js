const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const browserDownloader = require('../utils/browserDownloader');

function registerBrowserDownloaderControl() {
  ipcMain.handle('browser:navigate', async (event, url) => {
    try {
      return await browserDownloader.navigateTo(url);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('browser:resize', (event, bounds) => {
    browserDownloader.resizeBrowserView(bounds);
    return { success: true };
  });

  ipcMain.handle('browser:show', (event) => {
    browserDownloader.showBrowserView();
    return { success: true };
  });

  ipcMain.handle('browser:hide', (event) => {
    browserDownloader.hideBrowserView();
    return { success: true };
  });

  ipcMain.handle('browser:goBack', (event) => {
    browserDownloader.goBack();
    return { success: true };
  });

  ipcMain.handle('browser:goForward', (event) => {
    browserDownloader.goForward();
    return { success: true };
  });

  ipcMain.handle('browser:reload', (event) => {
    browserDownloader.reload();
    return { success: true };
  });

  ipcMain.handle('browser:getStreams', (event) => {
    const streams = browserDownloader.getCapturedStreams();
    return { success: true, streams };
  });

  ipcMain.handle('browser:clearStreams', (event) => {
    browserDownloader.clearCapturedStreams();
    return { success: true };
  });

  ipcMain.handle('browser:downloadStream', async (event, { stream, filename }) => {
    try {
      const isSub = stream.type === 'SUBTITLE';
      const defaultExt = isSub ? '.vtt' : '.mkv';
      const defaultPath = path.join(app.getPath('downloads'), 'ZenithStream', filename + defaultExt);
      
      const filters = isSub 
        ? [{ name: 'Subtitles', extensions: ['vtt', 'srt'] }]
        : [{ name: 'Videos', extensions: ['mkv', 'mp4', 'ts'] }];

      const { filePath } = await dialog.showSaveDialog({
        title: isSub ? 'Save Subtitle' : 'Save Video',
        defaultPath: defaultPath,
        filters: filters
      });

      if (!filePath) {
        return { success: false, error: 'Cancelled by user' };
      }

      // We don't await this so it happens in the background
      browserDownloader.downloadStream(stream, filePath).catch(console.error);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('browser:downloads', (event) => {
    return browserDownloader.getDownloads();
  });

  ipcMain.handle('browser:clearCompleted', (event) => {
    browserDownloader.clearCompletedDownloads();
    return { success: true };
  });

  ipcMain.handle('browser:cancelDownload', (event, jobId) => {
    browserDownloader.cancelDownload(jobId);
    return { success: true };
  });
}

module.exports = registerBrowserDownloaderControl;
