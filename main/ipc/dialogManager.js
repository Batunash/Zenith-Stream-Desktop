const { ipcMain,dialog} = require("electron");

module.exports = function registerDialogManager(){
  ipcMain.handle("dialog:openVideoFiles", async () => {
    const result = await dialog.showOpenDialog({
      title: "Video seç",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "avi", "mov"] }]
    });

    if (result.canceled) return [];

    return result.filePaths; 
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
};