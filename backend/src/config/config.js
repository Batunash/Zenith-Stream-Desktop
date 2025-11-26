const path = require('path');
const fs = require('fs');
const os = require('os');
const userDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.config');
const configPath = path.join(userDataPath, 'Video Hub', 'settings.json');

let userConfig = {};
if (fs.existsSync(configPath)) {
    try {
        userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {}
}

const config = {
    PORT: userConfig.PORT || 5000,
    JWT_SECRET: userConfig.JWT_SECRET || "gizli_anahtar",
    JWT_EXPIRES_IN: "7d",
    MEDIA_DIR: userConfig.MEDIA_DIR || path.join(os.homedir(), 'Desktop', 'Archive')
};

module.exports = config;