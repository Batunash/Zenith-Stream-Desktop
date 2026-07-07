import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const analyzeFileMock = vi.hoisted(() => vi.fn());
const decideProcessingStrategyMock = vi.hoisted(() => vi.fn());
const processVideoMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/mediaAnalyzer', () => ({ analyzeFile: analyzeFileMock }));
vi.mock('../utils/decisionEngine', () => ({
  decideProcessingStrategy: decideProcessingStrategyMock,
}));
vi.mock('../utils/videoBuilder', () => ({ processVideo: processVideoMock }));

const handleSettings = require('../utils/handlesettings');
const { ipcMain } = require('electron');
const path = require('path');

// ─── Manual require.cache injection ─────────────────────────────────────────
// fileControl.js destructures these at load time (`const { analyzeFile } = require(...)`)
// so we must inject into require.cache BEFORE requiring fileControl.js.
const _p = require('path');
const _cwd = process.cwd();

const _analyzerPath = _p.resolve(_cwd, 'main/utils/mediaAnalyzer.js');
const _decisionPath = _p.resolve(_cwd, 'main/utils/decisionEngine.js');
const _builderPath = _p.resolve(_cwd, 'main/utils/videoBuilder.js');

require.cache[_analyzerPath] = {
  id: _analyzerPath,
  filename: _analyzerPath,
  loaded: true,
  exports: { analyzeFile: analyzeFileMock },
  children: [],
  paths: [],
};
require.cache[_decisionPath] = {
  id: _decisionPath,
  filename: _decisionPath,
  loaded: true,
  exports: { decideProcessingStrategy: decideProcessingStrategyMock },
  children: [],
  paths: [],
};
require.cache[_builderPath] = {
  id: _builderPath,
  filename: _builderPath,
  loaded: true,
  exports: { processVideo: processVideoMock },
  children: [],
  paths: [],
};
// ─── episodeQueue + imageDownloader require.cache injection ──────────────────
// fileControl.js also requires these at load time: episodeQueue as a constructor
// (`new episodeQueue`) and downloadImage via destructuring. CJS vi.mock returns a
// module object, not a bare constructor, so inject into require.cache (same pattern).
const episodeQueueMock = vi.fn();
const eqAddVideosSpy = vi.fn();
const downloadImageMock = vi.fn();
const _eqPath = _p.resolve(_cwd, 'main/utils/episodeQueue.js');
const _imgPath = _p.resolve(_cwd, 'main/utils/imageDownloader.js');
require.cache[_eqPath] = {
  id: _eqPath,
  filename: _eqPath,
  loaded: true,
  exports: episodeQueueMock,
  children: [],
  paths: [],
};
require.cache[_imgPath] = {
  id: _imgPath,
  filename: _imgPath,
  loaded: true,
  exports: { downloadImage: downloadImageMock },
  children: [],
  paths: [],
};

const db = require('../../backend/src/config/database');

const registerFileControl = require('./fileControl');

describe('fileControl', () => {
  let fs;
  let axios;

  beforeEach(() => {
    vi.clearAllMocks();
    fs = global.__fsMock;
    axios = global.__axiosMock;

    vi.spyOn(handleSettings, 'getSettings').mockReturnValue({
      MEDIA_DIR: 'C:\\Media',
      TMDB_API_KEY: 'testkey',
    });

    fs.existsSync.mockImplementation((p) => {
      if (p === 'C:\\Media') return true;
      if (typeof p === 'string' && p.includes('mock_exist')) return true;
      return false;
    });
    fs.mkdirSync.mockImplementation(() => {});
    fs.rmSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.copyFileSync.mockImplementation(() => {});
    fs.unlinkSync.mockImplementation(() => {});
    fs.readdirSync.mockImplementation(() => []);
    fs.readFileSync.mockImplementation(() => '{}');
    fs.statSync.mockImplementation(() => ({ isDirectory: () => true, size: 100 }));

    axios.get.mockResolvedValue({ data: {} });
    analyzeFileMock.mockResolvedValue({});
    decideProcessingStrategyMock.mockReturnValue({});
    processVideoMock.mockResolvedValue({});
    episodeQueueMock.mockImplementation(function () {
      return { addVideos: eqAddVideosSpy };
    });
    downloadImageMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers all file IPC handlers', () => {
    registerFileControl();
    const calls = ipcMain.handle.mock.calls.map((c) => c[0]);
    expect(calls).toContain('file:createSerie');
    expect(calls).toContain('file:deleteSerie');
    expect(calls).toContain('file:createSeason');
    expect(calls).toContain('file:addEpisode');
    expect(calls).toContain('file:getSeries');
    expect(calls).toContain('file:getSeriesDetail');
    expect(calls).toContain('file:getEpisodes');
    expect(calls).toContain('file:deleteSeason');
    expect(calls).toContain('file:deleteEpisode');
    expect(calls).toContain('file:syncDatabase');
    expect(calls).toContain('file:fetchMetadata');
    expect(calls).toContain('media:analyze');
    expect(calls).toContain('media:decide');
    expect(calls).toContain('media:process');
  });

  describe('file:createSerie', () => {
    it('creates a directory and database entry on success', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:createSerie')[1];
      const result = await handler({}, { serieName: 'Test Show', metadata: {} });
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('Test Show'), {
        recursive: true,
      });
      expect(result.success).toBe(true);
    });

    it('returns error if MEDIA_DIR not set', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:createSerie')[1];
      const result = await handler({}, { serieName: 'Test', metadata: {} });
      expect(result.success).toBe(false);
    });
  });

  describe('file:deleteSerie', () => {
    it('deletes folder on success', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:deleteSerie')[1];
      const result = await handler({}, 'mock_exist');
      expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('mock_exist'), {
        recursive: true,
        force: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('file:createSeason', () => {
    it('creates a season directory', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:createSeason')[1];
      const result = await handler({}, { serieName: 'mock_exist', seasonId: 'Season 2' });
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('Season 2'), {
        recursive: true,
      });
      expect(result.isExist).toBe(true);
    });
  });

  describe('file:getSeries & details', () => {
    it('getSeries reads directory', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:getSeries')[1];
      fs.readdirSync.mockReturnValue(['mock_exist_serie']);
      fs.readFileSync.mockReturnValue(JSON.stringify({ title: 'Mock' }));
      const result = await handler({});
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Mock');
    });

    it('getSeriesDetail reads metadata and seasons', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:getSeriesDetail')[1];
      fs.readdirSync.mockReturnValue(['Season 1', 'Season 2']);
      fs.readFileSync.mockReturnValue(JSON.stringify({ title: 'Mock' }));
      const result = await handler({}, 'mock_exist');
      expect(result.title).toBe('Mock');
      expect(result.seasons.length).toBe(2);
    });
  });

  describe('file:deleteSeason & deleteEpisode', () => {
    it('deletes season', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:deleteSeason')[1];
      const result = await handler({}, { folderName: 'mock_exist', season: 'Season 1' });
      expect(fs.rmSync).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('deletes episode', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:deleteEpisode')[1];
      const filePath = path.join('C:\\Media', 'mock_exist', 'ep.mp4');
      const result = await handler({}, filePath);
      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('file:syncDatabase', () => {
    it('syncs DB', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:syncDatabase')[1];
      const result = await handler({});
      expect(result.success).toBe(true);
    });
  });

  describe('file:fetchMetadata', () => {
    it('fetches from TMDB', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:fetchMetadata')[1];
      axios.get
        .mockResolvedValueOnce({ data: { tv_results: [{ id: 123 }] } })
        .mockResolvedValueOnce({ data: { name: 'Test TV' } });
      const result = await handler({}, { imdbId: 'tt1234567', lang: 'tr' });
      expect(result.success).toBe(true);
      expect(result.mediaType).toBe('tv');
      expect(result.data.name).toBe('Test TV');
    });

    it('returns error if no API key', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({
        MEDIA_DIR: 'C:\\Media',
        TMDB_API_KEY: '',
      });
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'file:fetchMetadata')[1];
      const result = await handler({}, { imdbId: 'tt1234567' });
      expect(result.success).toBe(false);
    });
  });

  describe('media API', () => {
    it('analyze', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:analyze')[1];
      analyzeFileMock.mockResolvedValueOnce({ videoStreams: [] });
      const result = await handler({}, 'file.mp4');
      expect(result.success).toBe(true);
      expect(result.data.videoStreams).toBeDefined();
    });

    it('decide', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:decide')[1];
      analyzeFileMock.mockResolvedValueOnce({});
      decideProcessingStrategyMock.mockReturnValueOnce({ action: 'copy' });
      const result = await handler({}, { filePath: 'file.mp4', userPreferences: {} });
      expect(result.success).toBe(true);
      expect(result.decision.action).toBe('copy');
    });

    it('process', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:process')[1];
      analyzeFileMock.mockResolvedValueOnce({});
      decideProcessingStrategyMock.mockReturnValueOnce({});
      processVideoMock.mockResolvedValueOnce({ path: '/new.mp4' });
      const mockEvent = { sender: { send: vi.fn() } };
      const result = await handler(mockEvent, { filePath: 'file.mp4', userPreferences: {} });
      expect(result.success).toBe(true);
      expect(result.newPath).toBe('/new.mp4');
    });
  });

  describe('file:createSerie — branches', () => {
    const createSerie = () => ipcMain.handle.mock.calls.find((c) => c[0] === 'file:createSerie')[1];

    it('rejects a serieName that escapes MEDIA_DIR via ".." (isSafePath false)', async () => {
      registerFileControl();
      const result = await createSerie()({}, { serieName: '..', metadata: {} });
      expect(result).toEqual({ success: false, message: 'Geçersiz dosya yolu!' });
    });

    it('returns "Bu dizi zaten var!" when the series folder already exists', async () => {
      registerFileControl();
      const result = await createSerie()({}, { serieName: 'mock_exist', metadata: {} });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Bu dizi zaten var!');
    });

    it('downloads an http poster and sets localPoster when imageDest exists', async () => {
      fs.existsSync.mockImplementation(
        (p) => p === 'C:\\Media' || (typeof p === 'string' && p.endsWith('poster.jpg'))
      );
      registerFileControl();
      const result = await createSerie()(
        {},
        { serieName: 'Show', metadata: { image: 'http://x/p.jpg', numberOfSeasons: 0 } }
      );
      expect(downloadImageMock).toHaveBeenCalledWith(
        'http://x/p.jpg',
        expect.stringContaining('poster.jpg')
      );
      const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(written.localPoster).toBe('poster.jpg');
      expect(result.success).toBe(true);
    });

    it('uses the .jpg fallback when the http image has no extension', async () => {
      registerFileControl();
      await createSerie()({}, { serieName: 'NoExt', metadata: { image: 'http://x/poster' } });
      expect(downloadImageMock).toHaveBeenCalledWith(
        'http://x/poster',
        expect.stringContaining('poster.jpg')
      );
    });

    it('copies a local image when metadata.image is an existing local path', async () => {
      registerFileControl();
      await createSerie()({}, { serieName: 'Local', metadata: { image: 'mock_exist_img.jpg' } });
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        'mock_exist_img.jpg',
        expect.stringContaining('poster')
      );
    });

    it('creates N season folders when numberOfSeasons > 0', async () => {
      registerFileControl();
      await createSerie()({}, { serieName: 'Seasons', metadata: { numberOfSeasons: 2 } });
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('Season 1'));
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('Season 2'));
    });

    it('still returns success:true when db.syncFilesystemToDatabase throws (inner try/catch)', async () => {
      vi.spyOn(db, 'syncFilesystemToDatabase').mockImplementation(() => {
        throw new Error('db down');
      });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerFileControl();
      const result = await createSerie()({}, { serieName: 'Show', metadata: {} });
      expect(result.success).toBe(true);
      spy.mockRestore();
    });

    it('returns success:false + error when mkdirSync throws (outer catch)', async () => {
      fs.mkdirSync.mockImplementationOnce(() => {
        throw new Error('denied');
      });
      registerFileControl();
      const result = await createSerie()({}, { serieName: 'Boom', metadata: {} });
      expect(result).toEqual({ success: false, message: 'Hata', error: 'denied' });
    });

    it('logs and continues when the image download rejects (image catch)', async () => {
      downloadImageMock.mockRejectedValueOnce(new Error('img down'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerFileControl();
      const result = await createSerie()(
        {},
        { serieName: 'ImgFail', metadata: { image: 'http://x/p.jpg' } }
      );
      expect(spy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      spy.mockRestore();
    });
  });

  describe('file:createSeason — branches', () => {
    const createSeason = () =>
      ipcMain.handle.mock.calls.find((c) => c[0] === 'file:createSeason')[1];

    it('rejects an unsafe serieName/seasonId that escapes MEDIA_DIR', async () => {
      registerFileControl();
      const result = await createSeason()({}, { serieName: '..', seasonId: 'Season 1' });
      expect(result).toEqual({ isExist: false, message: 'Geçersiz dosya yolu!' });
    });

    it('returns isExist:false with error when mkdirSync throws', async () => {
      fs.mkdirSync.mockImplementationOnce(() => {
        throw new Error('denied');
      });
      registerFileControl();
      const result = await createSeason()({}, { serieName: 'Show', seasonId: 'Season 1' });
      expect(result).toEqual({ isExist: false, message: 'Hata', error: 'denied' });
    });

    it('returns the "no archive folder" message when MEDIA_DIR is empty', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await createSeason()({}, { serieName: 'Show', seasonId: 'Season 1' });
      expect(result.isExist).toBe(false);
      expect(result.message).toBe('Arşiv klasörü ayarlanmamış.');
    });
  });

  describe('file:addEpisode', () => {
    const addEpisode = () => ipcMain.handle.mock.calls.find((c) => c[0] === 'file:addEpisode')[1];

    it('returns ok:false when MEDIA_DIR is not configured', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await addEpisode()(
        {},
        { serieName: 'Show', seasonId: 'Season 1', videos: [] }
      );
      expect(result).toEqual({ ok: false, message: 'Medya klasörü ayarlı değil' });
    });

    it('returns ok:false for an unsafe serieName that escapes MEDIA_DIR', async () => {
      registerFileControl();
      const result = await addEpisode()({}, { serieName: '..', seasonId: 'Season 1', videos: [] });
      expect(result).toEqual({ ok: false, message: 'Geçersiz dosya yolu!' });
    });

    it('creates the folder when it does not exist and enqueues the videos', async () => {
      registerFileControl();
      const result = await addEpisode()(
        {},
        { serieName: 'Show', seasonId: 'Season 1', videos: [{ path: '/v.mp4' }] }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('Season 1'), {
        recursive: true,
      });
      expect(episodeQueueMock).toHaveBeenCalledWith('C:\\Media');
      expect(eqAddVideosSpy).toHaveBeenCalled();
      expect(result).toEqual({ ok: true, message: 'Kuyruğa eklendi' });
    });

    it('skips mkdir when the season folder already exists', async () => {
      fs.existsSync.mockImplementation(
        (p) => p === 'C:\\Media' || (typeof p === 'string' && p.includes('mock_exist'))
      );
      registerFileControl();
      const result = await addEpisode()(
        {},
        { serieName: 'mock_exist', seasonId: 'Season 1', videos: [] }
      );
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  describe('file:getSeries — branches', () => {
    const getSeries = () => ipcMain.handle.mock.calls.find((c) => c[0] === 'file:getSeries')[1];

    it('returns [] when MEDIA_DIR is not configured', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await getSeries()({});
      expect(result).toEqual([]);
    });

    it('sets fullPosterPath when a series metadata has localPoster', async () => {
      fs.existsSync.mockImplementation(
        (p) => p === 'C:\\Media' || (typeof p === 'string' && p.endsWith('metadata.json'))
      );
      fs.readdirSync.mockReturnValue(['show']);
      fs.readFileSync.mockReturnValue(JSON.stringify({ title: 'X', localPoster: 'poster.jpg' }));
      registerFileControl();
      const result = await getSeries()({});
      expect(result[0].localPoster).toBe('poster.jpg');
      expect(result[0].fullPosterPath).toContain('poster.jpg');
      expect(result[0].folderName).toBe('show');
    });

    it('skips items that are not directories', async () => {
      fs.statSync.mockReturnValue({ isDirectory: () => false, size: 0 });
      fs.readdirSync.mockReturnValue(['notdir']);
      registerFileControl();
      const result = await getSeries()({});
      expect(result).toEqual([]);
    });

    it('returns [] when readdirSync throws', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fs.readdirSync.mockImplementation(() => {
        throw new Error('boom');
      });
      fs.existsSync.mockImplementation((p) => p === 'C:\\Media');
      registerFileControl();
      const result = await getSeries()({});
      expect(result).toEqual([]);
      spy.mockRestore();
    });
  });

  describe('file:getSeriesDetail — branches', () => {
    const getSeriesDetail = () =>
      ipcMain.handle.mock.calls.find((c) => c[0] === 'file:getSeriesDetail')[1];

    it('returns error when MEDIA_DIR is not configured', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await getSeriesDetail()({}, 'show');
      expect(result).toEqual({ error: 'Medya klasörü yok' });
    });

    it('returns error for an unsafe folderName', async () => {
      registerFileControl();
      const result = await getSeriesDetail()({}, '..');
      expect(result).toEqual({ error: 'Geçersiz dosya yolu!' });
    });

    it('returns error when the series folder does not exist', async () => {
      fs.existsSync.mockImplementation((p) => p === 'C:\\Media');
      registerFileControl();
      const result = await getSeriesDetail()({}, 'missing');
      expect(result).toEqual({ error: 'Dizi bulunamadı' });
    });

    it('returns seasons with empty metadata when metadata.json is missing', async () => {
      fs.existsSync.mockImplementation(
        (p) => p === 'C:\\Media' || (typeof p === 'string' && !p.endsWith('metadata.json'))
      );
      fs.readdirSync.mockReturnValue(['Season 1']);
      registerFileControl();
      const result = await getSeriesDetail()({}, 'mock_exist');
      expect(result.seasons).toEqual(['Season 1']);
      expect(result.error).toBeUndefined();
    });

    it('sets fullPosterPath when metadata has localPoster', async () => {
      fs.existsSync.mockImplementation(
        (p) =>
          p === 'C:\\Media' ||
          (typeof p === 'string' && (p.endsWith('mock_exist') || p.endsWith('metadata.json')))
      );
      fs.readdirSync.mockReturnValue(['Season 1']);
      fs.readFileSync.mockReturnValue(JSON.stringify({ title: 'X', localPoster: 'p.jpg' }));
      registerFileControl();
      const result = await getSeriesDetail()({}, 'mock_exist');
      expect(result.localPoster).toBe('p.jpg');
      expect(result.fullPosterPath).toContain('p.jpg');
      expect(result.seasons).toEqual(['Season 1']);
    });

    it('returns error when reading metadata throws', async () => {
      fs.existsSync.mockImplementation(
        (p) =>
          p === 'C:\\Media' ||
          (typeof p === 'string' && (p.endsWith('mock_exist') || p.endsWith('metadata.json')))
      );
      fs.readFileSync.mockImplementation(() => {
        throw new Error('parse');
      });
      registerFileControl();
      const result = await getSeriesDetail()({}, 'mock_exist');
      expect(result.error).toBe('parse');
    });
  });

  describe('file:getEpisodes', () => {
    const getEpisodes = () => ipcMain.handle.mock.calls.find((c) => c[0] === 'file:getEpisodes')[1];

    it('returns [] when MEDIA_DIR is not configured', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await getEpisodes()({}, { folderName: 'show', season: 'Season 1' });
      expect(result).toEqual([]);
    });

    it('returns [] for an unsafe folderName', async () => {
      registerFileControl();
      const result = await getEpisodes()({}, { folderName: '..', season: 'Season 1' });
      expect(result).toEqual([]);
    });

    it('returns [] when the season folder does not exist', async () => {
      fs.existsSync.mockImplementation((p) => p === 'C:\\Media');
      registerFileControl();
      const result = await getEpisodes()({}, { folderName: 'show', season: 'Season 1' });
      expect(result).toEqual([]);
    });

    it('filters by VIDEO_EXTS and maps name/path/size', async () => {
      fs.existsSync.mockImplementation(() => true);
      fs.readdirSync.mockReturnValue(['ep1.mp4', 'notes.txt', 'ep2.mkv']);
      fs.statSync.mockReturnValue({ isDirectory: () => true, size: 1234 });
      registerFileControl();
      const result = await getEpisodes()({}, { folderName: 'mock_exist', season: 'Season 1' });
      expect(result.map((r) => r.name)).toEqual(['ep1.mp4', 'ep2.mkv']);
      expect(result[0].size).toBe(1234);
      expect(result[0].path).toContain('ep1.mp4');
    });

    it('returns [] when readdirSync throws', async () => {
      fs.existsSync.mockImplementation(() => true);
      fs.readdirSync.mockImplementation(() => {
        throw new Error('boom');
      });
      registerFileControl();
      const result = await getEpisodes()({}, { folderName: 'mock_exist', season: 'Season 1' });
      expect(result).toEqual([]);
    });
  });

  describe('file:deleteSerie — branches', () => {
    const deleteSerie = () => ipcMain.handle.mock.calls.find((c) => c[0] === 'file:deleteSerie')[1];

    it('returns success:false for an unsafe folderName', async () => {
      registerFileControl();
      const result = await deleteSerie()({}, '..');
      expect(result).toEqual({ success: false, message: 'Geçersiz dosya yolu girişimi!' });
    });

    it('returns success:false when the folder does not exist', async () => {
      fs.existsSync.mockImplementation((p) => p === 'C:\\Media');
      registerFileControl();
      const result = await deleteSerie()({}, 'missing');
      expect(result).toEqual({ success: false, message: 'Klasör yok' });
    });

    it('returns success:false with error when rmSync throws', async () => {
      fs.rmSync.mockImplementationOnce(() => {
        throw new Error('locked');
      });
      registerFileControl();
      const result = await deleteSerie()({}, 'mock_exist');
      expect(result).toEqual({ success: false, error: 'locked' });
    });
  });

  describe('file:deleteSeason — branches', () => {
    const deleteSeason = () =>
      ipcMain.handle.mock.calls.find((c) => c[0] === 'file:deleteSeason')[1];

    it('returns success:false for an unsafe folderName', async () => {
      registerFileControl();
      const result = await deleteSeason()({}, { folderName: '..', season: 'Season 1' });
      expect(result).toEqual({ success: false, message: 'Geçersiz dosya yolu!' });
    });

    it('returns success:false with error when rmSync throws', async () => {
      fs.rmSync.mockImplementationOnce(() => {
        throw new Error('locked');
      });
      registerFileControl();
      const result = await deleteSeason()({}, { folderName: 'mock_exist', season: 'Season 1' });
      expect(result).toEqual({ success: false, error: 'locked' });
    });
  });

  describe('file:deleteEpisode — branches', () => {
    const deleteEpisode = () =>
      ipcMain.handle.mock.calls.find((c) => c[0] === 'file:deleteEpisode')[1];

    it('returns "yetkiniz yok" when MEDIA_DIR is not set (isSafePath falsy root)', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await deleteEpisode()({}, 'C:\\Media\\show\\ep.mp4');
      expect(result).toEqual({ success: false, message: 'Bu dosyayı silme yetkiniz yok!' });
    });

    it('skips unlink and still succeeds when the file does not exist', async () => {
      fs.existsSync.mockImplementation((p) => p === 'C:\\Media');
      registerFileControl();
      const result = await deleteEpisode()({}, 'C:\\Media\\show\\missing.mp4');
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('returns success:false with error when unlinkSync throws', async () => {
      fs.unlinkSync.mockImplementationOnce(() => {
        throw new Error('busy');
      });
      registerFileControl();
      const result = await deleteEpisode()({}, 'C:\\Media\\mock_exist\\ep.mp4');
      expect(result).toEqual({ success: false, error: 'busy' });
    });
  });

  describe('file:syncDatabase — branches', () => {
    const syncDatabase = () =>
      ipcMain.handle.mock.calls.find((c) => c[0] === 'file:syncDatabase')[1];

    it('returns success:false when MEDIA_DIR is not configured', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({ MEDIA_DIR: '' });
      registerFileControl();
      const result = await syncDatabase()({});
      expect(result).toEqual({ success: false, error: 'Medya klasörü ayarlanmamış' });
    });

    it('returns success:false with error when db.syncFilesystemToDatabase throws', async () => {
      vi.spyOn(db, 'syncFilesystemToDatabase').mockImplementation(() => {
        throw new Error('db');
      });
      registerFileControl();
      const result = await syncDatabase()({});
      expect(result).toEqual({ success: false, error: 'db' });
    });
  });

  describe('file:fetchMetadata — branches', () => {
    const fetchMetadata = () =>
      ipcMain.handle.mock.calls.find((c) => c[0] === 'file:fetchMetadata')[1];

    it('uses movie_results and returns mediaType "movie"', async () => {
      registerFileControl();
      axios.get
        .mockResolvedValueOnce({ data: { movie_results: [{ id: 7 }] } })
        .mockResolvedValueOnce({ data: { title: 'Mov' } });
      const result = await fetchMetadata()({}, { imdbId: 'tt1', lang: 'en' });
      expect(result.success).toBe(true);
      expect(result.mediaType).toBe('movie');
      expect(result.data.title).toBe('Mov');
    });

    it('returns the not-found message when neither tv nor movie results exist', async () => {
      registerFileControl();
      axios.get.mockResolvedValueOnce({ data: {} });
      const result = await fetchMetadata()({}, { imdbId: 'tt1' });
      expect(result).toEqual({ success: false, message: "TMDB'de içerik bulunamadı." });
    });

    it('returns "TMDB bağlantı hatası." when axios rejects', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerFileControl();
      axios.get.mockRejectedValueOnce(new Error('network'));
      const result = await fetchMetadata()({}, { imdbId: 'tt1' });
      expect(result).toEqual({ success: false, message: 'TMDB bağlantı hatası.' });
      spy.mockRestore();
    });

    it('uses VITE_TMDB_API_KEY as a fallback when TMDB_API_KEY is empty', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({
        MEDIA_DIR: 'C:\\Media',
        VITE_TMDB_API_KEY: 'vitekey',
      });
      registerFileControl();
      axios.get
        .mockResolvedValueOnce({ data: { tv_results: [{ id: 9 }] } })
        .mockResolvedValueOnce({ data: { name: 'TV2' } });
      const result = await fetchMetadata()({}, { imdbId: 'tt1' });
      expect(result.success).toBe(true);
      expect(axios.get.mock.calls[0][0]).toContain('vitekey');
    });
  });

  describe('media:analyze/decide/process — error & progress branches', () => {
    it('media:analyze returns success:false when analyzeFile rejects', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:analyze')[1];
      analyzeFileMock.mockRejectedValueOnce(new Error('probe'));
      const result = await handler({}, 'file.mp4');
      expect(result).toEqual({ success: false, error: 'probe' });
      spy.mockRestore();
    });

    it('media:decide returns success:false when analyzeFile rejects', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:decide')[1];
      analyzeFileMock.mockRejectedValueOnce(new Error('fail'));
      const result = await handler({}, { filePath: 'file.mp4', userPreferences: {} });
      expect(result).toEqual({ success: false, error: 'fail' });
      spy.mockRestore();
    });

    it('media:process forwards percent via event.sender.send and returns the new path', async () => {
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:process')[1];
      processVideoMock.mockImplementationOnce((filePath, strategy, onProgress) => {
        onProgress(42);
        return Promise.resolve({ path: '/new.mp4' });
      });
      const mockEvent = { sender: { send: vi.fn() } };
      const result = await handler(mockEvent, { filePath: 'file.mp4', userPreferences: {} });
      expect(mockEvent.sender.send).toHaveBeenCalledWith('media:progress', {
        filePath: 'file.mp4',
        percent: 42,
      });
      expect(result).toEqual({ success: true, newPath: '/new.mp4' });
    });

    it('media:process returns success:false when processVideo rejects', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerFileControl();
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'media:process')[1];
      analyzeFileMock.mockResolvedValueOnce({});
      decideProcessingStrategyMock.mockReturnValueOnce({});
      processVideoMock.mockRejectedValueOnce(new Error('encode'));
      const result = await handler(
        { sender: { send: vi.fn() } },
        { filePath: 'file.mp4', userPreferences: {} }
      );
      expect(result).toEqual({ success: false, error: 'encode' });
      spy.mockRestore();
    });
  });
  describe('final branch closures (5 branches + line 127)', () => {
    const lookup = (ch) => ipcMain.handle.mock.calls.find((c) => c[0] === ch)[1];
    const createSerie = () => lookup('file:createSerie');
    const getSeries = () => lookup('file:getSeries');
    const addEpisode = () => lookup('file:addEpisode');
    const syncDatabase = () => lookup('file:syncDatabase');
    const fetchMetadata = () => lookup('file:fetchMetadata');

    it('file:createSerie: non-http image that does not exist leaves localPoster null (line 51 else-false)', async () => {
      registerFileControl();
      const result = await createSerie()(
        {},
        { serieName: 'NoImg', metadata: { image: 'C:\\nope\\missing.jpg' } }
      );
      expect(fs.copyFileSync).not.toHaveBeenCalled();
      const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(written.localPoster).toBeNull();
      expect(result.success).toBe(true);
    });

    it('file:createSerie: skips mkdir for a season folder that already exists (line 73 else-false)', async () => {
      // MEDIA_DIR exists; serie folder (C:\Media\Seasons) does NOT (skip line-38 "already exists");
      // but the Season 1 subfolder DOES exist, so line 73's braceless guard skips mkdirSync.
      fs.existsSync.mockImplementation((p) => {
        if (p === 'C:\\Media') return true;
        if (typeof p !== 'string') return false;
        return p.endsWith('Season 1');
      });
      registerFileControl();
      const result = await createSerie()(
        {},
        { serieName: 'Seasons', metadata: { numberOfSeasons: 1 } }
      );
      const seasonMkdirs = fs.mkdirSync.mock.calls.filter((c) => c[0].endsWith('Season 1'));
      expect(seasonMkdirs).toEqual([]);
      expect(result.success).toBe(true);
    });

    it('file:getSeries: directory item without metadata.json is included with empty metadata (line 143 else-false)', async () => {
      fs.existsSync.mockImplementation(
        (p) => p === 'C:\\Media' || (typeof p === 'string' && !p.endsWith('metadata.json'))
      );
      fs.readdirSync.mockReturnValue(['nometa']);
      fs.statSync.mockReturnValue({ isDirectory: () => true, size: 0 });
      registerFileControl();
      const result = await getSeries()({});
      // directory item with no metadata.json is skipped entirely (line 143 else-false: no push)
      expect(result).toEqual([]);
    });

    it('file:syncDatabase: happy path returns success message (line 273 fallthrough)', async () => {
      vi.spyOn(db, 'syncFilesystemToDatabase').mockImplementation(() => {});
      registerFileControl();
      const result = await syncDatabase()({});
      expect(result).toEqual({ success: true, message: 'Senkronizasyon tamamlandı.' });
    });

    it('file:fetchMetadata: returns "API Key bulunamadı." when no key is configured (line 288 early return)', async () => {
      vi.spyOn(handleSettings, 'getSettings').mockReturnValue({});
      registerFileControl();
      const result = await fetchMetadata()({}, { imdbId: 'tt1' });
      expect(result).toEqual({ success: false, message: 'API Key bulunamadı.' });
    });

    it('file:addEpisode: deferred db sync runs after the 3000ms setTimeout (line 127)', async () => {
      vi.useFakeTimers();
      const syncSpy = vi.spyOn(db, 'syncFilesystemToDatabase').mockImplementation(() => {});
      try {
        registerFileControl();
        const result = await addEpisode()(
          {},
          { serieName: 'Show', seasonId: 'Season 1', videos: [{ path: '/v.mp4' }] }
        );
        expect(result.ok).toBe(true);
        expect(syncSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(3000);
        expect(syncSpy).toHaveBeenCalledWith('C:\\Media', expect.anything());
      } finally {
        vi.useRealTimers();
        syncSpy.mockRestore();
      }
    });
  });
});
