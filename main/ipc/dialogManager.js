const { ipcMain,dialog} = require("electron");

module.exports = function registerDialogManager(){
    ipcMain.handle('dialog:openVideoFiles', async (event, args) => {
        const allowMultiple = args?.multiSelections !== false; 
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
            filters: [
                { name: 'Movies', extensions: ['mkv', 'avi', 'mp4', 'mov'] }
            ]
        });
        if (canceled) {
            return [];
        } else {
            return filePaths;
        }
    });
  ipcMain.handle("dialog:openFileImage", async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            title: 'Dizi Posteri Seç',
            buttonLabel: 'Bu Resmi Seç',
            filters: [
                { name: 'Görseller', extensions: ['jpg', 'png', 'jpeg', 'webp'] }
            ]
        });
        if (canceled) {
            return null;
        } else {
            return filePaths[0];
        }
    });
    ipcMain.handle("dialog:openDirectory", async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Medya Klasörünü Seç',
            properties: ['openDirectory'] 
        });
        return canceled ? null : filePaths[0];
    });
    ipcMain.handle("dialog:openSubtitleFile", async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Altyazı Dosyası Seç',
            properties: ['openFile'],
            filters: [
                { name: 'Altyazı Dosyaları', extensions: ['srt', 'ass', 'vtt'] }
            ]
        });
        return canceled ? null : filePaths[0];
    });
};