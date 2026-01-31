const { contextBridge, ipcRenderer } = require("electron");
const validChannels = [
  "auth:login",   
  "auth:register", 
  "server:start",
  "server:stop",
  "server:getNetworkInfo",
  "server:status",
  "file:createSerie",
  "file:getSeries",
  "file:createSeason",
  "file:addEpisode",
  "file:addEpisode:progress", 
  "file:addEpisode:done",
  "file:getSeriesDetail", 
  "file:getEpisodes",   
  "file:deleteSerie",
  "file:deleteSeason",
  "file:deleteEpisode",  
  "file:syncDatabase",
  "file:fetchMetadata",
  "dialog:openVideoFiles",
  "dialog:openFileImage",
  "dialog:openDirectory",
  "dialog:openSubtitleFile",
  "settings:get",
  "settings:save",
  "app:restart",
  "window:minimize",
  "window:maximize",
  "window:close",
  "media:analyze",
  "media:decide",
  "media:process",
  "media:progress"
];

contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn("Blocked IPC channel:", channel);
    }
  },
  receive: (channel, func) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    } else {
      console.warn("Blocked IPC channel:", channel);
    }
  },
  invoke: (channel, args) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, args);
    } else {
      console.warn("Blocked IPC channel:", channel);
    }
  },
  remove: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
