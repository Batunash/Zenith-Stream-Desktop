const decideProcessingStrategy = (analysisReport, userOptions = null) => {
    const { video, audio, subtitles } = analysisReport;
    
    let strategy = {
        video: { action: 'copy', codec: 'copy' },
        audio: { action: 'copy', codec: 'copy' },
        subtitles: [], 
        requiresReEncode: false
    };

    let targetSubs = [];
    
    if (userOptions && userOptions.selectedIndices && userOptions.selectedIndices.length > 0) {
        targetSubs = subtitles.filter(s => userOptions.selectedIndices.includes(s.index));
    } 
    else {
        targetSubs = subtitles; 
    }
    if (video.codec !== 'h264') {
        strategy.video = { action: 'encode', codec: 'libx264', preset: 'fast' };
        strategy.requiresReEncode = true;
    }
    const primaryAudio = audio[0];
    if (primaryAudio && primaryAudio.codec !== 'aac') {
        strategy.audio = { action: 'encode', codec: 'aac' };
    }
    const burnIndex = userOptions?.burnIndex;

    targetSubs.forEach(sub => {
        // A) BURN-IN (Gömme) Durumu
        if (sub.index === burnIndex || sub.type === 'pgs' || sub.type === 'vobsub') {
            strategy.subtitles.push({
                index: sub.index,
                language: sub.language,
                action: 'burn', 
                type: sub.type
            });
            strategy.video.action = 'encode';
            strategy.video.codec = 'libx264';
            strategy.requiresReEncode = true;
        } 
        else {
            strategy.subtitles.push({
                index: sub.index,
                language: sub.language,
                title: sub.title || sub.language,
                action: 'soft_convert',
                targetCodec: 'mov_text'
            });
        }
    });

    return strategy;
};

module.exports = { decideProcessingStrategy };