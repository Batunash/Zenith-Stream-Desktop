const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { burnExternalSrt } = require('../utils/burnExternalSubtitle');

module.exports = function registerBurnControl() {
    ipcMain.handle('media:burnExternalSubtitle', async (event, args) => {
        const { videoPath, srtPath } = args || {};
        try {
            if (!videoPath || !fs.existsSync(videoPath)) {
                return { success: false, code: 'NO_VIDEO', error: 'Video file not found.' };
            }
            if (!srtPath || !fs.existsSync(srtPath)) {
                return { success: false, code: 'NO_SRT', error: 'SRT file not found.' };
            }

            const send = (payload) => {
                event.sender.send('media:burnExternalSubtitle:progress', payload);
            };

            send({ percent: 0 });
            await burnExternalSrt(videoPath, srtPath, (percent) => {
                send({ percent });
            });
            send({ percent: 100 });

            return { success: true, path: videoPath };
        } catch (err) {
            console.error('[Burn] error:', err);
            return { success: false, code: 'BURN_FAILED', error: err.message };
        }
    });
};
