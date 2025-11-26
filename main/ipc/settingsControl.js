const { ipcMain, app } = require("electron");
const {getSettings,saveSettings}=require("./../utils/handlesettings")

module.exports = function registerSettingsControl() {
    ipcMain.handle("settings:get", async () => {
        return getSettings();
    });
    ipcMain.handle("settings:save", async (event, config) => {
        try {
            saveSettings(config);
            return { success: true, message: "Ayarlar kaydedildi." };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    ipcMain.handle("app:restart", () => {
        app.relaunch();
        app.exit();
    });
};