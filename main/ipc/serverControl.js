const { ipcMain } = require("electron");
const os =require('os');
const serverManager = require("../../backend/index");
let serverProcess = null

module.exports = function registerServerControlIPC() {
  ipcMain.handle("server:start", async () => {
    try {
      const mediaService = require("../../backend/src/services/mediaService");
      mediaService.initializeDatabase();
      await serverManager.start(); 
      return { running: true, message: "Server started" };
    } catch (err) {
      console.error("Server Start Error:", err);
      return { running: false, message: err.message };
    }
  });
  ipcMain.handle("server:stop", async () => {
    try {
      await serverManager.stop();
      return { running: false, message: "Server stopped" };
    } catch (err) {
      return { running: true, message: err.message };
    }
  });
  ipcMain.handle("server:status", async () => {
    const running = serverManager.isRunning();
    return { running };
  });
  ipcMain.handle("server:getNetworkInfo", async () => {
        try {
            const nets = os.networkInterfaces();
            const results = {};

            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        if (!results[name]) results[name] = [];
                        results[name].push(net.address);
                    }
                }
            }
            const firstKey = Object.keys(results)[0];
            const ip = firstKey ? results[firstKey][0] : "127.0.0.1";
            return { ip };
        } catch (e) {
            console.error("IP Bulma Hatası:", e);
            return { ip: "127.0.0.1" };
        }
    });
};
