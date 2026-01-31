const path = require("path");
const { app, BrowserWindow, protocol, net } = require("electron"); 
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,UseOzonePlatform");
app.commandLine.appendSwitch("ozone-platform", "x11");
app.disableHardwareAcceleration();
const isDev = !app.isPackaged;
const registerServerControlIPC = require("./ipc/serverControl");
const registerFileControl = require("./ipc/fileControl");
const registerDialogManager = require("./ipc/dialogManager");
const registerAuthControl = require("./ipc/authControl");
const registerSettingsControl = require("./ipc/settingsControl")
const registerWindowControl = require("./ipc/windowControl");
let mainWindow;


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: "#0d0d0d",
    autoHideMenuBar: true,
    frame: false,
    title: "Zenith Stream",
    icon: path.join(__dirname, '../assets/icon.png'),
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
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));  }
}
function registerIpcHandlers() {
  registerServerControlIPC();
  registerFileControl();
  registerDialogManager();
  registerAuthControl();
  registerSettingsControl();
  registerWindowControl();
}

app.whenReady().then(() => {
  
 protocol.registerFileProtocol("media", (request, callback) => {
    let filePath = request.url.replace("media://", "");
    filePath = decodeURIComponent(filePath);
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(app.getPath("userData"), filePath);
    }

    callback({ path: filePath });
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