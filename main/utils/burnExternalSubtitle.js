const ffmpeg = require('./ffmpegHelper');
const path = require('path');
const fs = require('fs');

const escapePath = (filePath) => {
  let normalized = filePath.replace(/\\/g, '/');
  normalized = normalized.replace(/^([a-zA-Z]):/, '$1\\:');
  return normalized;
};

const burnExternalSrt = (videoPath, srtPath, onProgress) => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(videoPath);
    const name = path.parse(videoPath).name;
    const tempPath = path.join(dir, `temp_${name}_${Date.now()}.mp4`);

    const safeSrt = escapePath(srtPath);
    const filter = `subtitles='${safeSrt}'`;

    ffmpeg(videoPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions('-preset', 'fast')
      .outputOptions('-crf', '23')
      .outputOptions('-movflags', '+faststart')
      .videoFilters(filter)
      .output(tempPath)
      .on('progress', (progress) => {
        if (progress.percent && onProgress) {
          onProgress(progress.percent.toFixed(1));
        }
      })
      .on('end', () => {
        try {
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
          }
          fs.renameSync(tempPath, videoPath);
          resolve({ success: true, path: videoPath });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        console.error('[Burn] ffmpeg error:', err.message);
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch (_) {}
        }
        reject(err);
      })
      .run();
  });
};

module.exports = { burnExternalSrt };
