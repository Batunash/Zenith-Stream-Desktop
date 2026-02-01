const { ipcMain, app } = require("electron");
const { getSettings, saveSettings, moveArchiveContents } = require("./../utils/handlesettings");
const db = require("../../backend/src/config/database");
const { VIDEO_EXTS } = require("../../backend/src/constants");

module.exports = function registerSettingsControl() {
    ipcMain.handle("settings:get", async () => {
        return getSettings();
    });

    ipcMain.handle("settings:save", async (event, newConfig) => {
        try {
            const currentSettings = getSettings();
            const oldPath = currentSettings.MEDIA_DIR;
            const newPath = newConfig.MEDIA_DIR;

            if (newPath && newPath !== oldPath) {
                moveArchiveContents(oldPath, newPath);
            }
            saveSettings(newConfig);
            db.syncFilesystemToDatabase(newPath, VIDEO_EXTS);

            return { success: true };
        } catch (err) {
            console.error("Settings save error:", err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("app:restart", () => {
        app.relaunch();
        app.exit();
    });
};