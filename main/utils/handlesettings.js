const { app } = require('electron'); 
const path = require("path");
const fs = require('fs');
const CONFIG_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_CONFIG = {
    PORT: '5000',
    MEDIA_DIR: path.join(app.getPath('home'), 'Desktop', 'Archive'),
    JWT_SECRET: 'gizli_anahtar_degistir',
    TMDB_API_KEY: ''
};

const getSettings = () => {
    if (!fs.existsSync(CONFIG_PATH)) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
        return DEFAULT_CONFIG;
    }
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
        return DEFAULT_CONFIG;
    }
};

const saveSettings = (newConfig) => {
    const current = getSettings();
    const final = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(final, null, 2));
};

module.exports={
    getSettings,
    saveSettings
}