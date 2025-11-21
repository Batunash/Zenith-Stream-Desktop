const path = require("path");
const { app, BrowserWindow, protocol, net } = require("electron"); 
const isDev = !app.isPackaged;
const registerServerControlIPC = require("./ipc/serverControl");
const registerFileControl = require("./ipc/fileControl");
const registerDialogManager = require("./ipc/dialogManager");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: "#0d0d0d",
    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preLoad.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173/renderer/index.html");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  }
}
function registerIpcHandlers() {
  registerServerControlIPC();
  registerFileControl();
  registerDialogManager();
}
app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    const filePath = request.url.slice('media://'.length);
    return net.fetch('file://' + decodeURIComponent(filePath));
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});