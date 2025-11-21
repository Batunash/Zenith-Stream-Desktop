const axios = require('axios');
const fs = require('fs');

const downloadImage = async (url, destPath) => {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(destPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error("Resim indirme hatası:", error.message);
    }
};

module.exports={
    downloadImage
}