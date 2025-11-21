const { ipcMain } = require("electron");
const path= require('path');
const fs = require("fs");
const { MEDIA_DIR } = require('../../config/config');
const episodeQueue = require("../utils/episodeQueue");
const { downloadImage} =require("../utils/imageDownloader");
const eq = new episodeQueue(MEDIA_DIR);


module.exports = function registerFileControl(){
    ipcMain.handle("file:createSerie", async (event, { serieName, metadata }) => {
        if (!fs.existsSync(MEDIA_DIR)) return { success: false, message: "Archive directory not exists" };
        const safeName = serieName.replace(/[<>:"/\\|?*]+/g, '');
        const fullPath = path.join(MEDIA_DIR, safeName);
        if (fs.existsSync(fullPath)) return { success: false, message: "Bu dizi zaten var!", path: fullPath };
        try {
            fs.mkdirSync(fullPath, { recursive: true });
            let localImagePath = null;
            if (metadata.image) {
                const imageExt = path.extname(metadata.image) || '.jpg';
                const imageFileName = `poster${imageExt}`;
                const imageDest = path.join(fullPath, imageFileName);

                if (metadata.image.startsWith('http')) {
                    await downloadImage(metadata.image, imageDest);
                } else {
                    fs.copyFileSync(metadata.image, imageDest);
                }
                localImagePath = imageFileName;
            }
            const jsonContent = {
                ...metadata,
                folderName: safeName,
                localPoster: localImagePath,
                createdAt: new Date().toISOString()
            };
            fs.writeFileSync(
                path.join(fullPath, 'metadata.json'), 
                JSON.stringify(jsonContent, null, 2)
            );
            if (metadata.numberOfSeasons > 0) {
                for (let i = 1; i <= metadata.numberOfSeasons; i++) {
                    const seasonPath = path.join(fullPath, `Season ${i}`);
                    if (!fs.existsSync(seasonPath)) {
                        fs.mkdirSync(seasonPath);
                    }
                }
            }
            return { success: true, message: "Dizi ve dosyalar başarıyla oluşturuldu", path: fullPath };
        } catch (err) {
            console.error("Kritik Hata:", err);
            return { success: false, message: "Dizi oluşturulurken hata çıktı", error: err.message };
        }
    });
  ipcMain.handle("file:createSeason",(event,data)=>{
    if((!fs.existsSync(MEDIA_DIR)))return{isExist: false, message:"archive directroy is not exists"};
    const fullPath = path.join(MEDIA_DIR, data.serieName, data.seasonId);
    try {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log("Klasör oluşturuldu:", fullPath);
            return { isExist: true, message: "Folder created successfully", path: fullPath };
    } catch (err) {
            console.error("Hata:", err);
            return { isExist: false, message: "Error creating folder", error: err.message };
    }
  });
  ipcMain.handle("file:addEpisode", (event, data) => {
        const fullPath = path.join(MEDIA_DIR, data.serieName, data.seasonId);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        eq.addVideos(
        data.videos.map(f => ({...f,filePath:f.path,destFolder: fullPath,event}))
        );

        return { ok: true, message: "Videos queued" };
});
    ipcMain.handle("file:getSeries", async () => {
        if (!fs.existsSync(MEDIA_DIR)) return [];
        try {
            const items = fs.readdirSync(MEDIA_DIR);
            const seriesList = [];
            for (const item of items) {
                const itemPath = path.join(MEDIA_DIR, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const metaPath = path.join(itemPath, 'metadata.json');
                    if (fs.existsSync(metaPath)) {
                        const rawData = fs.readFileSync(metaPath);
                        const jsonData = JSON.parse(rawData);
                        if (jsonData.localPoster) {
                            jsonData.fullPosterPath = path.join(itemPath, jsonData.localPoster);
                        }
                        seriesList.push(jsonData);
                    }
                }
            }
            return seriesList;
        } catch (err) {
            console.error("Diziler okunurken hata:", err);
            return [];
        }
    });

}