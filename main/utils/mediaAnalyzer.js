const ffmpeg = require('./ffmpegHelper');
const normalizeSubtitleType = (codec) => {
    const map = {
        'subrip': 'srt',
        'ass': 'ass',
        'ssa': 'ass',
        'hdmv_pgs_subtitle': 'pgs',
        'dvd_subtitle': 'vobsub',
        'mov_text': 'tx3g'
    };
    return map[codec] || 'unknown';
};
const analyzeFile = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error("FFprobe Analyze Hatası:", err);
                return reject(err);
            }
            const rawStreams = metadata.streams;
            const videoStreams = rawStreams
                .filter(s => s.codec_type === 'video')
                .map(s => ({
                    index: s.index,
                    codec: s.codec_name,
                    resolution: `${s.width}x${s.height}`,
                    width: s.width,
                    height: s.height,
                    fps: s.avg_frame_rate,
                    duration: s.duration || metadata.format.duration
                }));
            const audioStreams = rawStreams
                .filter(s => s.codec_type === 'audio')
                .map(s => ({
                    index: s.index,
                    codec: s.codec_name, 
                    channels: s.channels,
                    language: s.tags?.language || 'und', 
                    title: s.tags?.title || 'Unknown'
                }));
            const subtitleStreams = rawStreams
                .filter(s => s.codec_type === 'subtitle')
                .map(s => ({
                    index: s.index,
                    codec: s.codec_name,
                    type: normalizeSubtitleType(s.codec_name), 
                    language: s.tags?.language || 'und',
                    title: s.tags?.title || null,
                    isForced: s.disposition?.forced === 1
                }));
            const report = {
                filename: filePath,
                container: metadata.format.format_name,
                duration: metadata.format.duration,
                video: videoStreams[0] || null, 
                audio: audioStreams,
                subtitles: subtitleStreams,
                totalStreams: rawStreams.length
            };

            resolve(report);
        });
    });
};

module.exports = { analyzeFile };