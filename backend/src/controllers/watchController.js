const watchService = require('../services/watchService');
const fs = require('fs');
const path = require('path');
const db = require('../config/database'); 
async function startWatch(req, res) {
    try {
        const result = watchService.watch(req);
        
        if (result.headers) {
            res.status(206).set(result.headers);
            result.file.pipe(res);
        } else {
            const mimeType = watchService.getMimeType(result.filePath);
            const headers = {
                'Content-Type': mimeType,
                'Content-Length': result.fileSize,
                'Accept-Ranges': 'bytes',
            };
            res.status(200).set(headers);
            fs.createReadStream(result.filePath).pipe(res);
        }
    } catch (e) {
        console.error("Watch Error:", e.message);
        if (!res.headersSent) res.status(404).json({ error: e.message });
    }
}

async function updateProgress(req, res) {
  try {
    const { episodeId } = req.params;
    const { progress, watchTime } = req.body;
    const userId = req.user?.id;
    
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    
    watchService.updateProgress(userId, episodeId, progress, watchTime);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PROGRESS_UPDATE_FAILED' });
  }
}

async function downloadEpisode(req, res) {
    try {
        const { episodeId } = req.params;
        const episode = db.getEpisodeById(episodeId);
        if (!episode) return res.status(404).json({ error: 'Episode not found' });        
        const filePath = episode.FILE_PATH;
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
        const safeFileName = `S${episode.SEASON_ID}E${episode.EPISODE_NUMBER}_${episode.NAME.replace(/[^a-z0-9]/gi, '_')}.mp4`;
        res.download(filePath, safeFileName);

    } catch (e) {
        console.error("Download Error:", e);
        if (!res.headersSent) res.status(500).json({ error: 'DOWNLOAD_FAILED' });
    }
}

module.exports = {
  startWatch,
  updateProgress,
  downloadEpisode 
};