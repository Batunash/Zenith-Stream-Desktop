const fs = require("fs");
const path=require("path");

class episodeQueue {
  constructor(mediaDir, maxParallel = 2) {
    this.mediaDir = mediaDir;
    this.maxParallel = maxParallel;
    this.queue = [];
    this.activeCount = 0;
  }

  moveVideo(src, destFolder, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const fileName = path.basename(src);
      const dest = path.join(destFolder, fileName);

      if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

      const total = fs.statSync(src).size;
      let transferred = 0;

      const read = fs.createReadStream(src);
      const write = fs.createWriteStream(dest);

      read.on("data", chunk => {
        transferred += chunk.length;
        onProgress(Math.round((transferred / total) * 100));
      });

      write.on("finish", () => {
        fs.unlink(src, (err) => {
            if (err) {
                console.warn("Dosya kopyalandı ama silinemedi:", src);
                resolve(dest); 
            } else {
                console.log("Dosya taşındı (orijinal silindi):", src);
                resolve(dest);
            }
        });
      });
      write.on("error", reject);

      read.pipe(write);
    });
  }

  addVideos(videos) {
    this.queue.push(...videos);
    this.processQueue();
  }

  processQueue() {
    while (this.activeCount < this.maxParallel && this.queue.length > 0) {
      const item = this.queue.shift();
      this.activeCount++;
      this.moveVideo(item.filePath, item.destFolder, percent => {
        item.event.sender.send("file:addEpisode:progress", { file: item.filePath, percent });
      })
        .then(dest => {
          item.event.sender.send("file:addEpisode:done", { file: item.filePath, path: dest });
        })
        .catch(err => {
          item.event.sender.send("file:addEpisode:done", { file: item.filePath, error: err.message });
        })
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }
}

module.exports = episodeQueue;
