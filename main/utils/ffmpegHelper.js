const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const { app } = require('electron');
const os = require('os');
let ffmpegPath;
let ffprobePath;
const platform = os.platform();
let archFolder = '';
let execExt = '';

if (platform === 'win32') {
    archFolder = 'win';
    execExt = '.exe';
} else if (platform === 'linux') {
    archFolder = 'linux';
} else if (platform === 'darwin') {
    archFolder = 'mac';
} else {
    console.error("Unsuported ", platform);
}
let basePath;
if (app.isPackaged) {
    basePath = path.join(process.resourcesPath, 'bin', archFolder);
} else {
    basePath = path.join(__dirname, '../../resources/bin', archFolder);
}
ffmpegPath = path.join(basePath, `ffmpeg${execExt}`);
ffprobePath = path.join(basePath, `ffprobe${execExt}`);
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
if (!app.isPackaged) {
    console.log(`FFmpeg (${platform}) Path:`, ffmpegPath);
}

module.exports = ffmpeg;