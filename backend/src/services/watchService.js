const fs = require('fs');
const path = require('path');
const { MEDIA_DIR }  = require('../config/config');
const { db } = require('./mediaService');


function watch (req){
    const {episodeId}=req.params;
    const episode = db.getEpisodeById(episodeId);
    const filePath = episode.FILE_PATH;
    if (!episode) {
    throw new Error('Episode not found in database');
    }
    if (!fs.existsSync(filePath)) {
    throw new Error('File not found on disk');
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if(range){
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const headers = {
        'Content-Type': 'video/mp4',
        'Content-Length': chunkSize,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
       };
       return {headers, file}
    }
    
    return {filePath,fileSize,headers:null}

}
function updateProgress(userId, episodeId, progress, watchTime = 0) {
  try {
    return db.updateWatchProgress(userId, episodeId, progress, watchTime);
  } catch (error) {
    console.error('Error updating watch progress:', error);
    throw error;
  }
}
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm'
  };
  return mimeTypes[ext] || 'video/mp4';
}
module.exports = { 
  watch, 
  updateProgress,
  getMimeType 
};;