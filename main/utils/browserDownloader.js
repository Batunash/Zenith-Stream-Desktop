const { BrowserWindow, BrowserView, app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpegHelper = require('./ffmpegHelper');

let captureView = null;
let capturedStreams = [];
let activeDownloads = [];
let isCapturing = false;
const requestHeadersMap = new Map();

function getMainWindow() {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

function notifyRenderer(channel, data) {
  const mainWindow = getMainWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Initialize the BrowserView and set up interception
 */
function initBrowserView() {
  if (captureView && !captureView.webContents.isDestroyed()) {
    return captureView;
  }

  captureView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const ses = captureView.webContents.session;
  ses.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  capturedStreams = [];
  isCapturing = true;

  console.log('[BrowserDownloader] Setting up network interception...');

  // Capture request headers before they are sent
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    if (isCapturing) {
      const u = details.url.split('?')[0].toLowerCase();
      if (
        u.endsWith('.m3u8') ||
        u.endsWith('.mp4') ||
        u.endsWith('.ts') ||
        u.endsWith('.m4s') ||
        u.includes('master.txt') ||
        u.includes('index.txt') ||
        u.endsWith('.vtt') ||
        u.endsWith('.srt')
      ) {
        requestHeadersMap.set(cleanUrl(details.url), details.requestHeaders);
      }
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Setup interception
  ses.webRequest.onResponseStarted({ urls: ['*://*/*'] }, (details) => {
    if (!isCapturing) return;

    const url = details.url;
    const statusCode = details.statusCode;

    if (statusCode >= 200 && statusCode < 300) {
      const cleanUrlStr = url.split('?')[0].toLowerCase();

      // HLS playlist can be .m3u8, or disguised as master.txt / index.txt
      const isM3U8 =
        cleanUrlStr.endsWith('.m3u8') ||
        cleanUrlStr.includes('master.txt') ||
        cleanUrlStr.includes('index.txt');
      const isMP4 =
        (cleanUrlStr.endsWith('.mp4') || cleanUrlStr.includes('.mp4?')) &&
        !url.includes('googlevideo');
      const isTS = cleanUrlStr.endsWith('.ts') && !url.includes('googletagmanager');
      const isM4S = cleanUrlStr.endsWith('.m4s');
      const isSub =
        cleanUrlStr.endsWith('.vtt') ||
        cleanUrlStr.endsWith('.srt') ||
        url.includes('.vtt?') ||
        url.includes('.srt?');

      const contentType = (details.responseHeaders?.['content-type']?.[0] || '').toLowerCase();
      const isVideoType = contentType.includes('video') || contentType.includes('mpegurl');

      // Temel atlama kuralları
      const skipPatterns = [
        'google-analytics',
        'facebook.com',
        'doubleclick.net',
        'googletagmanager',
        'ads.',
        'pixel.',
        'analytics.',
        'hotjar.',
        'tawk.',
        'cdn.shopify',
        '/ad/',
        '/ads/',
        '/sponsor',
        'jwpltx.com',
      ];

      if (skipPatterns.some((p) => url.toLowerCase().includes(p))) return;

      // Bazen siteler .m3u8 veya .ts dosyalarını .txt ve .jpg gibi gizler.
      const isDisguised = url.includes('/hls/') || url.includes('.mp4/');
      const extensionSkips = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '.ico',
        '.css',
        '.js',
        '.woff',
        '.ttf',
      ];

      // Gizlenmiş bir video stream değilse ve resim/css ise atla
      if (!isDisguised && !isM3U8 && extensionSkips.some((ext) => cleanUrlStr.endsWith(ext)))
        return;

      // .txt dosyalarını atla, AMA master.txt veya index.txt ise playlist'tir atlama
      if (cleanUrlStr.endsWith('.txt') && !isM3U8) return;

      // Gizlenmiş ts parçalarını (image001.jpg gibi) atla, çünkü bize sadece master playlist (txt/m3u8) lazım!
      // Eğer bunları atlarsak liste yüzlerce parçayla dolmaz.
      if (
        isDisguised &&
        (cleanUrlStr.match(/image\d+\.jpg/) ||
          extensionSkips.some((ext) => cleanUrlStr.endsWith(ext)))
      ) {
        return;
      }

      if (url.includes('seg-') || url.includes('chunk') || (url.includes('index-') && !isM3U8)) {
        return;
      }

      const size = details.bytesReceived || 0;
      if (size > 0 && size < 50000 && !isM3U8 && !isVideoType && !isSub) return;

      if (isM3U8 || isMP4 || isTS || isM4S || isVideoType || isSub) {
        const type = isSub
          ? 'SUBTITLE'
          : isM3U8
            ? 'HLS'
            : isMP4
              ? 'MP4'
              : isTS
                ? 'TS'
                : isM4S
                  ? 'DASH'
                  : 'STREAM';

        // Attempt to get page title for context naming
        const pageTitle = captureView.webContents.getTitle() || 'Video';

        const streamInfo = {
          id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          url: cleanUrl(url),
          type: type,
          size: details.bytesReceived || 0,
          contentType: contentType,
          timestamp: Date.now(),
          pageTitle: pageTitle,
        };

        const exists = capturedStreams.some((s) => s.url === streamInfo.url);
        if (!exists) {
          capturedStreams.push(streamInfo);
          console.log('[BrowserDownloader] CAPTURED:', streamInfo.url);
          notifyRenderer('browser:streamDetected', streamInfo);
        }
      }
    }
  });

  // Navigation events
  captureView.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) {
      notifyRenderer('browser:urlChanged', url);
    }
  });

  captureView.webContents.on('page-title-updated', (event, title) => {
    notifyRenderer('browser:titleChanged', title);
  });

  captureView.webContents.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' && captureView.webContents.canGoBack()) {
      captureView.webContents.goBack();
    } else if (cmd === 'browser-forward' && captureView.webContents.canGoForward()) {
      captureView.webContents.goForward();
    }
  });

  return captureView;
}

function cleanUrl(url) {
  try {
    url = url.split('#')[0];
    const cleanUrl = new URL(url);
    const paramsToRemove = ['utm_', 'fbclid', 'gclid', '_ga', '_gl'];
    paramsToRemove.forEach((p) => cleanUrl.searchParams.delete(p));
    return cleanUrl.toString();
  } catch {
    return url.split('?')[0];
  }
}

async function navigateTo(url) {
  const view = initBrowserView();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Treat as search if no dots
    if (!url.includes('.') || url.includes(' ')) {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else {
      url = 'https://' + url;
    }
  }

  console.log('[BrowserDownloader] Navigating to:', url);

  await view.webContents.loadURL(url, {
    extraHeaders: `
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
    `.trim(),
  });

  return { success: true, url };
}

function resizeBrowserView(bounds) {
  if (captureView && !captureView.webContents.isDestroyed()) {
    captureView.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  }
}

function showBrowserView() {
  const mainWin = getMainWindow();
  if (mainWin && captureView) {
    mainWin.setBrowserView(captureView);
  } else if (mainWin) {
    const view = initBrowserView();
    mainWin.setBrowserView(view);
  }
}

function hideBrowserView() {
  const mainWin = getMainWindow();
  if (mainWin && captureView) {
    mainWin.removeBrowserView(captureView);
  }
}

function goBack() {
  if (captureView && captureView.webContents.canGoBack()) {
    captureView.webContents.goBack();
  }
}

function goForward() {
  if (captureView && captureView.webContents.canGoForward()) {
    captureView.webContents.goForward();
  }
}

function reload() {
  if (captureView) {
    captureView.webContents.reload();
  }
}

function getCapturedStreams() {
  return capturedStreams.map((s) => ({
    ...s,
    sizeMB: (s.size / (1024 * 1024)).toFixed(2),
  }));
}

function clearCapturedStreams() {
  capturedStreams = [];
}

// Downloads management
async function downloadStream(stream, outputPath) {
  return new Promise(async (resolve, reject) => {
    const jobId = `dl_${Date.now()}`;
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`[${jobId}] Downloading: ${stream.url}`);

    const downloadObj = {
      id: jobId,
      url: stream.url,
      outputPath: outputPath,
      status: 'starting',
      percent: 0,
      title: stream.pageTitle,
    };

    activeDownloads.push(downloadObj);
    notifyRenderer('browser:downloads', getDownloads());

    // Fetch captured headers to bypass 404s
    let headerStr = '';
    const reqHeaders = requestHeadersMap.get(stream.url);

    if (reqHeaders) {
      for (const [key, value] of Object.entries(reqHeaders)) {
        const k = key.toLowerCase();
        if (k === 'referer' || k === 'cookie' || k === 'origin' || k === 'authorization') {
          headerStr += `${key}: ${value}\r\n`;
        }
      }
    }

    // Fallback if headers were not captured
    if (!headerStr) {
      try {
        if (captureView && !captureView.webContents.isDestroyed()) {
          const pageUrl = captureView.webContents.getURL();

          const streamCookies = await captureView.webContents.session.cookies.get({
            url: stream.url,
          });
          const pageCookies = await captureView.webContents.session.cookies.get({ url: pageUrl });

          const cookieMap = {};
          pageCookies.forEach((c) => (cookieMap[c.name] = c.value));
          streamCookies.forEach((c) => (cookieMap[c.name] = c.value));

          const cookiePairs = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`);
          const origin = new URL(pageUrl).origin;

          if (cookiePairs.length > 0) {
            headerStr = `Referer: ${pageUrl}\r\nOrigin: ${origin}\r\nCookie: ${cookiePairs.join('; ')}\r\n`;
          } else {
            headerStr = `Referer: ${pageUrl}\r\nOrigin: ${origin}\r\n`;
          }
        }
      } catch (e) {
        console.error('Error getting fallback cookies for ffmpeg', e);
      }
    }

    const isSubStream = stream.type === 'SUBTITLE';
    let targetStreamUrl = stream.url;
    let tempStandaloneSubFile = null;

    if (isSubStream) {
      try {
        const fetchHeaders = {};
        if (reqHeaders) {
          for (const [key, value] of Object.entries(reqHeaders)) {
            fetchHeaders[key] = value;
          }
        }
        if (headerStr) {
          const lines = headerStr.split('\r\n').filter(Boolean);
          for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx > -1) {
              fetchHeaders[line.substring(0, colonIdx).trim()] = line
                .substring(colonIdx + 1)
                .trim();
            }
          }
        }
        if (!fetchHeaders['User-Agent'] && !fetchHeaders['user-agent']) {
          fetchHeaders['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }

        const response = await net.fetch(stream.url, { headers: fetchHeaders });
        if (response.ok) {
          const text = await response.text();
          tempStandaloneSubFile = path.join(
            os.tmpdir(),
            `zenith_standalone_sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.vtt`
          );
          fs.writeFileSync(tempStandaloneSubFile, text);
          targetStreamUrl = tempStandaloneSubFile;
          console.log(
            `[BrowserDownloader] Fetched standalone subtitle locally: ${targetStreamUrl}`
          );
        } else {
          console.warn(
            `[BrowserDownloader] Standalone subtitle fetch failed with ${response.status}`
          );
          return reject(
            new Error(
              `Subtitle download failed (HTTP ${response.status}). The link might be expired or blocked.`
            )
          );
        }
      } catch (err) {
        console.error(`[BrowserDownloader] Error fetching standalone subtitle: ${err.message}`);
        return reject(new Error(`Subtitle fetch error: ${err.message}`));
      }
    }

    const isHLS = stream.url.includes('.m3u8') || stream.type === 'HLS';
    let command = ffmpegHelper(targetStreamUrl);

    let userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    if (reqHeaders) {
      const uaKey = Object.keys(reqHeaders).find((k) => k.toLowerCase() === 'user-agent');
      if (uaKey) userAgent = reqHeaders[uaKey];
    }

    const inputOptions = [];
    const isLocalInput = targetStreamUrl.startsWith('/') || targetStreamUrl.match(/^[a-zA-Z]:\\/);

    if (!isLocalInput) {
      inputOptions.push('-user_agent', userAgent);
      if (headerStr) {
        inputOptions.push('-headers', headerStr);
      }
    }

    const outputOptions = [];

    const isMp4 = outputPath.toLowerCase().endsWith('.mp4');
    const isMkv = outputPath.toLowerCase().endsWith('.mkv');

    const externalSubtitles =
      stream.type !== 'SUBTITLE' ? capturedStreams.filter((s) => s.type === 'SUBTITLE') : [];
    const hasExternalSubs = externalSubtitles.length > 0 && (isMkv || isMp4);

    // Tüm video, ses (Dual) ve altyazı akışlarını (streams) dahil et
    outputOptions.push('-map', '0:v?', '-map', '0:a?');
    if (!hasExternalSubs) {
      outputOptions.push('-map', '0:s?'); // Eğer dışarıdan altyazı yoksa içerdekileri (varsa) al
    }

    if (isHLS) {
      if (!isLocalInput) {
        inputOptions.push(
          '-protocol_whitelist',
          'file,http,https,tcp,udp,tls,crypto',
          '-fflags',
          '+discardcorrupt',
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5',
          '-rw_timeout',
          '60000000'
        );
      }
      inputOptions.push('-analyzeduration', '20000000', '-probesize', '20000000');
      outputOptions.push('-c:v', 'copy', '-c:a', 'copy');
      if (isMp4) {
        outputOptions.push(
          '-c:s',
          'mov_text',
          '-bsf:a',
          'aac_adtstoasc',
          '-movflags',
          '+faststart'
        );
      } else {
        outputOptions.push('-c:s', 'srt');
      }
    } else {
      if (!isLocalInput) {
        inputOptions.push(
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5',
          '-rw_timeout',
          '60000000'
        );
      }
      outputOptions.push('-c:v', 'copy', '-c:a', 'copy');
      if (isMp4) {
        outputOptions.push('-c:s', 'mov_text', '-movflags', '+faststart');
      } else {
        outputOptions.push('-c:s', 'srt');
      }
    }

    command = command.inputOptions(inputOptions);

    // Otomatik Altyazı (Subtitle) Birleştirme ve İsimlendirme İşlemi
    const tempSubFiles = [];
    if (hasExternalSubs) {
      let subIndex = 1; // input index starting from 1 (0 is video)
      let outSubIndex = 0; // output subtitle stream index starting from 0

      for (const sub of externalSubtitles) {
        const subReqHeaders = requestHeadersMap.get(sub.url);
        let subHeaderStr = '';
        const fetchHeaders = {};
        if (subReqHeaders) {
          for (const [key, value] of Object.entries(subReqHeaders)) {
            const k = key.toLowerCase();
            fetchHeaders[key] = value;
            if (k === 'referer' || k === 'cookie' || k === 'origin' || k === 'authorization') {
              subHeaderStr += `${key}: ${value}\r\n`;
            }
          }
        }
        if (!subHeaderStr) subHeaderStr = headerStr;

        // FFmpeg'in 404 hatalarında çökmesini önlemek için altyazıyı önce geçici klasöre indir
        try {
          const response = await net.fetch(sub.url, { headers: fetchHeaders });
          if (!response.ok) {
            console.warn(`[BrowserDownloader] Subtitle failed with ${response.status}: ${sub.url}`);
            continue; // Skip this subtitle
          }
          const text = await response.text();
          const tmpPath = path.join(
            os.tmpdir(),
            `zenith_sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.vtt`
          );
          fs.writeFileSync(tmpPath, text);
          tempSubFiles.push(tmpPath);

          command = command.input(tmpPath); // Yerel dosyayı kullan

          // Yerel dosya için header'a gerek yok
          outputOptions.push('-map', `${subIndex}:s?`);

          const subUrlLower = sub.url.toLowerCase();
          let lang = 'und';
          let title = 'Subtitle';

          if (subUrlLower.includes('forced')) {
            lang = 'tur';
            title = 'Türkçe(Forced)';
          } else if (
            subUrlLower.includes('tur') ||
            subUrlLower.includes('tr') ||
            subUrlLower.includes('tr-')
          ) {
            lang = 'tur';
            title = 'Türkçe';
          } else if (
            subUrlLower.includes('eng') ||
            subUrlLower.includes('en') ||
            subUrlLower.includes('en-')
          ) {
            lang = 'eng';
            title = 'English';
          } else if (subUrlLower.includes('ger') || subUrlLower.includes('de')) {
            lang = 'ger';
            title = 'Deutsch';
          } else if (subUrlLower.includes('fre') || subUrlLower.includes('fr')) {
            lang = 'fre';
            title = 'Français';
          }

          outputOptions.push(`-metadata:s:s:${outSubIndex}`, `language=${lang}`);
          outputOptions.push(`-metadata:s:s:${outSubIndex}`, `title=${title}`);

          subIndex++;
          outSubIndex++;
        } catch (err) {
          console.error(`[BrowserDownloader] Failed to fetch subtitle: ${err.message}`);
          continue;
        }
      }
    }

    command = command.outputOptions(outputOptions);

    downloadObj.command = command;

    command.on('progress', (progress) => {
      if (progress.percent && progress.percent > 0) {
        downloadObj.percent = Math.floor(Math.min(progress.percent, 100));
      } else {
        downloadObj.sizeKB = progress.targetSize || 0;
      }
      downloadObj.status = 'downloading';
      notifyRenderer('browser:progress', {
        jobId,
        percent: downloadObj.percent,
        sizeKB: downloadObj.sizeKB,
        status: 'downloading',
        url: stream.url,
      });

      // Update the downloads list periodically
      if (!downloadObj.lastNotify || Date.now() - downloadObj.lastNotify > 1000) {
        downloadObj.lastNotify = Date.now();
        notifyRenderer('browser:downloads', getDownloads());
      }
    });

    command.on('end', () => {
      downloadObj.percent = 100;
      downloadObj.status = 'completed';
      notifyRenderer('browser:complete', { jobId, status: 'completed', outputPath });
      notifyRenderer('browser:downloads', getDownloads());
      // Temizleme
      tempSubFiles.forEach((f) => fs.unlink(f, () => {}));
      if (tempStandaloneSubFile) fs.unlink(tempStandaloneSubFile, () => {});
      resolve({ success: true, path: outputPath });
    });

    command.on('error', (err) => {
      downloadObj.status = 'failed';
      downloadObj.error = err.message;
      notifyRenderer('browser:error', { jobId, error: err.message });
      notifyRenderer('browser:downloads', getDownloads());
      // Temizleme
      tempSubFiles.forEach((f) => fs.unlink(f, () => {}));
      if (tempStandaloneSubFile) fs.unlink(tempStandaloneSubFile, () => {});
      reject(new Error(`Download failed: ${err.message}`));
    });

    command.save(outputPath);
  });
}

function getDownloads() {
  return activeDownloads.map((d) => ({
    id: d.id,
    url: d.url,
    status: d.status,
    percent: d.percent,
    sizeKB: d.sizeKB,
    title: d.title,
    outputPath: d.outputPath,
    error: d.error,
  }));
}

function clearCompletedDownloads() {
  activeDownloads = activeDownloads.filter(
    (d) => d.status !== 'completed' && d.status !== 'failed' && d.status !== 'cancelled'
  );
  notifyRenderer('browser:downloads', getDownloads());
}

function cancelDownload(jobId) {
  const download = activeDownloads.find((d) => d.id === jobId);
  if (
    download &&
    download.command &&
    (download.status === 'starting' || download.status === 'downloading')
  ) {
    try {
      download.command.kill('SIGKILL');
      download.status = 'cancelled';
      notifyRenderer('browser:cancelDownload', { jobId });
      notifyRenderer('browser:downloads', getDownloads());
    } catch (e) {
      console.error('Failed to kill ffmpeg process', e);
    }
  }
}

module.exports = {
  initBrowserView,
  navigateTo,
  resizeBrowserView,
  showBrowserView,
  hideBrowserView,
  goBack,
  goForward,
  reload,
  getCapturedStreams,
  clearCapturedStreams,
  downloadStream,
  getDownloads,
  clearCompletedDownloads,
  cancelDownload,
};
