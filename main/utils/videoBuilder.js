const ffmpeg = require('./ffmpegHelper');
const path = require('path');
const fs = require('fs'); 

const escapePath = (filePath) => {
    let normalized = filePath.replace(/\\/g, '/');
    normalized = normalized.replace(/^([a-zA-Z]):/, '$1\\:');
    return normalized;
};

const processVideo = (inputPath, strategy, onProgress) => {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(inputPath);
        const name = path.parse(inputPath).name;
        const finalPath = path.join(dir, `${name}.mp4`);
        const tempPath = path.join(dir, `temp_${name}_${Date.now()}.mp4`);        
        let command = ffmpeg(inputPath);
        
        if (strategy.externalSubtitle) {
            command.input(strategy.externalSubtitle);
        }

        command.output(tempPath)
            .videoCodec(strategy.video.codec)
            .audioCodec(strategy.audio.codec);
            
        if (strategy.video.action === 'encode') {
            command.outputOptions('-preset', strategy.video.preset || 'fast');
        }
        
        const burnSub = strategy.subtitles.find(s => s.action === 'burn');
        
        if (burnSub) {
            const safePath = escapePath(inputPath);
            const filter = `subtitles='${safePath}':si=${burnSub.index}`;
            command.videoFilters(filter);
        } 
        else {
            let outputIndex = 0;
            strategy.subtitles.forEach((sub) => {
                if (sub.action === 'soft_convert') {
                    // DÜZELTME: -map ve değerini ayrı argümanlar olarak veriyoruz
                    command.outputOptions('-map', `0:${sub.index}`);
                    command.outputOptions(`-c:s:${outputIndex}`, 'mov_text');
                    command.outputOptions(`-metadata:s:s:${outputIndex}`, `language=${sub.language}`);
                    
                    if(sub.title) {
                        // DÜZELTME: Boşluk içeren başlıklar için argümanları ayırıyoruz
                        command.outputOptions(`-metadata:s:s:${outputIndex}`, `title=${sub.title}`);
                    }
                    outputIndex++;
                }
            });
            if (strategy.externalSubtitle) {
                command.outputOptions('-map', '1:0');
                command.outputOptions(`-c:s:${outputIndex}`, 'mov_text');
                command.outputOptions(`-metadata:s:s:${outputIndex}`, 'language=tur');
                command.outputOptions(`-metadata:s:s:${outputIndex}`, 'title=External');
                outputIndex++;
            }
        }
        if (!burnSub) {
            // DÜZELTME: -map komutlarını güvenli hale getirdik
            command.outputOptions('-map', '0:v');
            command.outputOptions('-map', '0:a');
        }

        command.outputOptions('-movflags', '+faststart');
        command
            .on('progress', (progress) => {
                if (progress.percent && onProgress) {
                    onProgress(progress.percent.toFixed(1));
                }
            })
            .on('end', () => {
                try {
                    console.log('✅ Dönüştürme bitti, dosya değişimi yapılıyor...');

                    if (fs.existsSync(inputPath)) {
                        fs.unlinkSync(inputPath);
                    }
                    if (inputPath !== finalPath && fs.existsSync(finalPath)) {
                        fs.unlinkSync(finalPath);
                    }
                    fs.renameSync(tempPath, finalPath);
                    resolve({ success: true, path: finalPath });

                } catch (err) {
                    console.error(err);
                    reject(err);
                }
            })
            .on('error', (err) => {
                console.error( err.message);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            })
            .run();
    });
};

module.exports = { processVideo };