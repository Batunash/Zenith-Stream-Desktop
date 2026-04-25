const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { getSettings } = require('../utils/handlesettings');
const {
    extractSubtitleToSrt,
    translateSrt,
    SubtitleError
} = require('../utils/subtitleTranslator');

module.exports = function registerTranslateControl() {
    ipcMain.handle('media:translateSubtitle', async (event, args) => {
        const { videoPath, streamIndex, sourceCodec, targetLang, targetLangName } = args || {};
        try {
            if (!videoPath || !fs.existsSync(videoPath)) {
                return { success: false, code: 'NO_VIDEO', error: 'Video file not found.' };
            }
            if (typeof streamIndex !== 'number') {
                return { success: false, code: 'NO_STREAM', error: 'Subtitle stream index missing.' };
            }
            if (!targetLang) {
                return { success: false, code: 'NO_TARGET', error: 'Target language missing.' };
            }

            const settings = getSettings();
            const provider = settings.AI_PROVIDER || 'nvidia';
            const apiKey = provider === 'gemini' ? settings.GEMINI_API_KEY : settings.NVIDIA_API_KEY;
            if (!apiKey) {
                return { success: false, code: 'NO_KEY', error: `${provider.toUpperCase()} API key is not set.`, provider };
            }

            const send = (payload) => {
                event.sender.send('media:translateSubtitle:progress', payload);
            };

            console.log(`[Translate] START provider=${provider} video=${videoPath} stream=${streamIndex} codec=${sourceCodec} -> ${targetLang}`);
            send({ stage: 'extract', percent: 0 });
            const srtText = await extractSubtitleToSrt(videoPath, streamIndex, sourceCodec);
            console.log(`[Translate] Extracted ${srtText.length} chars of SRT`);

            send({ stage: 'translate', percent: 0 });
            const langName = targetLangName || targetLang;
            const translated = await translateSrt(srtText, langName, provider, apiKey, (info) => {
                send(info);
            });

            const dir = path.dirname(videoPath);
            const base = path.parse(videoPath).name;
            const srtPath = path.join(dir, `${base}.${targetLang}.srt`);
            fs.writeFileSync(srtPath, translated, 'utf8');
            console.log(`[Translate] DONE -> ${srtPath} (${translated.length} chars)`);

            send({ stage: 'done', percent: 100 });
            return { success: true, srtPath };
        } catch (err) {
            console.error(`[Translate] FAILED code=${err?.code || 'UNKNOWN'} msg=${err?.message}`);
            if (err instanceof SubtitleError) {
                return { success: false, code: err.code, error: err.message };
            }
            return { success: false, code: 'UNKNOWN', error: err.message };
        }
    });
};
