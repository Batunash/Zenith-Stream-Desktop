const { app } = require('electron'); 
const path = require("path");
const fs = require('fs');
const crypto = require('crypto');

const CONFIG_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_CONFIG = {
    PORT: '5000',
    MEDIA_DIR: path.join(app.getPath('home'), 'Desktop', 'Archive'),
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
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

const moveArchiveContents = (oldPath, newPath) => {
    if (!oldPath || !newPath || oldPath === newPath) return;
    if (!fs.existsSync(oldPath)) return;

    if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
    }

    const items = fs.readdirSync(oldPath);

    for (const item of items) {
        const oldItemPath = path.join(oldPath, item);
        const newItemPath = path.join(newPath, item);

        try {
            const stats = fs.statSync(oldItemPath);
            if (stats.isDirectory()) {
                fs.cpSync(oldItemPath, newItemPath, { recursive: true });
                fs.rmSync(oldItemPath, { recursive: true, force: true });
            } else {
                fs.copyFileSync(oldItemPath, newItemPath);
                fs.unlinkSync(oldItemPath);
            }
        } catch (err) {
            console.error(`Taşıma hatası: ${item}`, err);
            throw new Error(`${item} kullanımda veya kilitli olduğu için taşınamadı. Lütfen açık videoları kapatın.`);
        }
    }
};

module.exports = { getSettings, saveSettings, moveArchiveContents };