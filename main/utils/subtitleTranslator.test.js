import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Stable ffmpeg mock, shared across the suite ──────────────────────────────
// ffmpegHelper.js does `module.exports = ffmpeg` (the fluent-ffmpeg FUNCTION),
// and subtitleTranslator calls BOTH `ffmpeg(path)` and `ffmpeg.ffprobe(...)`.
// So the mock must be a CALLABLE vi.fn with `.ffprobe` attached.
const { ffmpegMock, ffprobeMock } = vi.hoisted(() => ({
  ffmpegMock: vi.fn(),
  ffprobeMock: vi.fn(),
}));
ffmpegMock.ffprobe = ffprobeMock;

// vi.mock factory (covers the ESM import path). The CJS require() path below uses
// the require.cache injection, which is what actually wins for inner requires
// when the global Module.prototype.require interceptor is installed (see
// vitest.setup.js) — that interceptor's originalRequire predates vi.mock and so
// never consults it, but it DOES consult require.cache.
vi.mock('./ffmpegHelper', () => ({ default: ffmpegMock, ffprobe: ffprobeMock }));

const _path = require('path');
const _ffmpegHelperPath = _path.resolve(process.cwd(), 'main/utils/ffmpegHelper.js');
require.cache[_ffmpegHelperPath] = {
  id: _ffmpegHelperPath,
  filename: _ffmpegHelperPath,
  loaded: true,
  exports: ffmpegMock,
  children: [],
  paths: [],
};

// axios & fs come from the global CJS require interceptor (shared singletons
// global.__axiosMock / global.__fsMock). Same instances subtitleTranslator sees.
const axiosMock = require('axios');
const fs = global.__fsMock;
const subtitleTranslator = require('./subtitleTranslator');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SEPARATOR = '\n###~~~###\n';
const cue = (i, text = 'Hello') => `${i}\n00:00:01,000 --> 00:00:02,000\n${text}`;
const srt = (...cues) => cues.join('\n\n') + '\n';
const geminiResp = (text) => ({
  status: 200,
  data: { candidates: [{ content: { parts: [{ text }] } }] },
});
const nvidiaResp = (text) => ({ status: 200, data: { choices: [{ message: { content: text } }] } });
const httpErr = (status, data) => {
  const e = new Error(`http ${status}`);
  e.response = { status, data, headers: {} };
  return e;
};
const joinSegs = (segs) => segs.join(SEPARATOR);
const withBeginEnd = (body) => `--- BEGIN ---\n${body}\n--- END ---`;

// Fluent ffmpeg chain: every method returns `this`; `.run()` fires 'end' (default)
// or 'error' so we can drive the success / failure paths deterministically.
const makeChain = (opts = {}) => {
  const cbs = {};
  const chain = {
    input: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    on: vi.fn((ev, cb) => {
      cbs[ev] = cb;
      return chain;
    }),
    run: vi.fn(() => {
      if (opts.error) cbs.error?.(opts.error);
      else cbs.end?.();
    }),
  };
  return chain;
};

describe('subtitleTranslator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.post.mockReset();
    ffmpegMock.mockReset();
    ffmpegMock.ffprobe = ffprobeMock; // re-attach in case mockReset dropped it
    ffprobeMock.mockReset();
    // fs defaults (clearAllMocks keeps impls; set sane defaults each run)
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('content');
    fs.unlinkSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});
  });

  // ───────── exports & constants ─────────
  describe('exports & constants', () => {
    it('TEXT_SUB_CODECS contains the text subtitle codecs', () => {
      expect(subtitleTranslator.TEXT_SUB_CODECS.has('subrip')).toBe(true);
      expect(subtitleTranslator.TEXT_SUB_CODECS.has('ass')).toBe(true);
      expect(subtitleTranslator.TEXT_SUB_CODECS.has('ssa')).toBe(true);
      expect(subtitleTranslator.TEXT_SUB_CODECS.has('mov_text')).toBe(true);
      expect(subtitleTranslator.TEXT_SUB_CODECS.has('webvtt')).toBe(true);
      expect(subtitleTranslator.TEXT_SUB_CODECS.has('srt')).toBe(false);
    });

    it('IMAGE_SUB_CODECS contains image subtitle codecs', () => {
      expect(subtitleTranslator.IMAGE_SUB_CODECS.has('hdmv_pgs_subtitle')).toBe(true);
      expect(subtitleTranslator.IMAGE_SUB_CODECS.has('dvd_subtitle')).toBe(true);
      expect(subtitleTranslator.IMAGE_SUB_CODECS.has('dvb_subtitle')).toBe(true);
      expect(subtitleTranslator.IMAGE_SUB_CODECS.has('subrip')).toBe(false);
    });

    it('SubtitleError carries code and is an Error', () => {
      const e = new subtitleTranslator.SubtitleError('CODE_X', 'boom');
      expect(e).toBeInstanceOf(Error);
      expect(e.code).toBe('CODE_X');
      expect(e.message).toBe('boom');
    });
  });

  // ───────── extractSubtitleToSrt ─────────
  describe('extractSubtitleToSrt', () => {
    it('rejects IMAGE_SUB for image-based codecs', async () => {
      await expect(
        subtitleTranslator.extractSubtitleToSrt('/v.mp4', 2, 'hdmv_pgs_subtitle')
      ).rejects.toMatchObject({ code: 'IMAGE_SUB' });
    });

    it('rejects UNSUPPORTED_SUB for unknown text codecs', async () => {
      await expect(
        subtitleTranslator.extractSubtitleToSrt('/v.mp4', 2, 'some_unknown')
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_SUB' });
    });

    it('extracts text content on ffmpeg end and cleans up the tmp file', async () => {
      fs.readFileSync.mockReturnValue('# extracted subtitle content');
      ffmpegMock.mockReturnValue(makeChain());
      const out = await subtitleTranslator.extractSubtitleToSrt('/v.mp4', 1, 'subrip');
      expect(out).toBe('# extracted subtitle content');
      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(ffmpegMock).toHaveBeenCalledWith('/v.mp4');
    });

    it('skips the codec guards when sourceCodec is undefined', async () => {
      fs.readFileSync.mockReturnValue('plain text');
      ffmpegMock.mockReturnValue(makeChain());
      const out = await subtitleTranslator.extractSubtitleToSrt('/v.mp4', 0);
      expect(out).toBe('plain text');
    });

    it('rejects EMPTY_SUB when extracted content is blank', async () => {
      fs.readFileSync.mockReturnValue('   ');
      ffmpegMock.mockReturnValue(makeChain());
      await expect(
        subtitleTranslator.extractSubtitleToSrt('/v.mp4', 1, 'subrip')
      ).rejects.toMatchObject({ code: 'EMPTY_SUB' });
    });

    it('rejects with the read error when readFileSync throws', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      ffmpegMock.mockReturnValue(makeChain());
      await expect(subtitleTranslator.extractSubtitleToSrt('/v.mp4', 1, 'subrip')).rejects.toThrow(
        'EACCES'
      );
    });

    it('rejects EXTRACT_FAILED on ffmpeg error and cleans up tmp when present', async () => {
      fs.existsSync.mockReturnValue(true);
      ffmpegMock.mockReturnValue(makeChain({ error: new Error('ffmpeg crashed') }));
      await expect(
        subtitleTranslator.extractSubtitleToSrt('/v.mp4', 1, 'subrip')
      ).rejects.toMatchObject({ code: 'EXTRACT_FAILED' });
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('does not throw when cleanup during ffmpeg error fails', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('locked');
      });
      ffmpegMock.mockReturnValue(makeChain({ error: new Error('crash') }));
      await expect(
        subtitleTranslator.extractSubtitleToSrt('/v.mp4', 1, 'subrip')
      ).rejects.toMatchObject({ code: 'EXTRACT_FAILED' });
    });
  });

  // ───────── embedSubtitleIntoMp4 ─────────
  describe('embedSubtitleIntoMp4', () => {
    it('embeds the subtitle, sets ISO3 language/title metadata, then unlinks and renames', async () => {
      ffprobeMock.mockImplementation((_p, cb) =>
        cb(null, {
          streams: [
            { codec_type: 'video' },
            { codec_type: 'subtitle' },
            { codec_type: 'subtitle' },
          ],
        })
      );
      ffmpegMock.mockReturnValue(makeChain());
      await subtitleTranslator.embedSubtitleIntoMp4('/v/movie.mp4', '/v/sub.srt', 'en', 'English');
      expect(ffmpegMock).toHaveBeenCalledWith('/v/movie.mp4');
      const chain = ffmpegMock.mock.results[0].value;
      expect(chain.input).toHaveBeenCalledWith('/v/sub.srt');
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:2', 'language=eng');
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:2', 'title=English');
      expect(chain.outputOptions).toHaveBeenCalledWith('-movflags', '+faststart');
      expect(fs.unlinkSync).toHaveBeenCalledWith('/v/movie.mp4');
      expect(fs.renameSync).toHaveBeenCalled();
    });

    it('defaults the title to uppercased langCode when title is not given', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, { streams: [] }));
      ffmpegMock.mockReturnValue(makeChain());
      await subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'tr');
      const chain = ffmpegMock.mock.results[0].value;
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:0', 'language=tur');
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:0', 'title=TR');
    });

    it('falls back to the raw code when ISO2 has no ISO3 mapping', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, { streams: [] }));
      ffmpegMock.mockReturnValue(makeChain());
      await subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'xx');
      const chain = ffmpegMock.mock.results[0].value;
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:0', 'language=xx');
    });

    it('treats an ffprobe error as zero existing subtitle streams', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(new Error('probe fail'), null));
      ffmpegMock.mockReturnValue(makeChain());
      await subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'en');
      const chain = ffmpegMock.mock.results[0].value;
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:0', 'language=eng');
    });

    it('rejects EMBED_FAILED on ffmpeg error and cleans up the temp file', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, { streams: [] }));
      fs.existsSync.mockReturnValue(true);
      ffmpegMock.mockReturnValue(makeChain({ error: new Error('mux failed') }));
      await expect(
        subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'en')
      ).rejects.toMatchObject({ code: 'EMBED_FAILED' });
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('rejects with the fs error when renameSync throws', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, { streams: [] }));
      fs.renameSync.mockImplementation(() => {
        throw new Error('EPERM');
      });
      ffmpegMock.mockReturnValue(makeChain());
      await expect(
        subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'en')
      ).rejects.toThrow('EPERM');
    });
  });

  // ───────── translateSrt — Gemini ─────────
  describe('translateSrt (Gemini)', () => {
    it('throws EMPTY_SUB when srt text has no valid cues', async () => {
      await expect(
        subtitleTranslator.translateSrt('Just random text', 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'EMPTY_SUB' });
    });

    it('translates a valid SRT through the Gemini default model, stripping BEGIN/END', async () => {
      const validSrt = srt(cue(1, 'Hello World'));
      axiosMock.post.mockResolvedValueOnce(geminiResp(withBeginEnd('Merhaba Dünya')));
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'mockKey');
      expect(result).toContain('Merhaba Dünya');
      expect(result).toContain('00:00:01,000 --> 00:00:02,000');
      expect(axiosMock.post).toHaveBeenCalledTimes(1);
      const [url, body] = axiosMock.post.mock.calls[0];
      expect(url).toContain('gemini-2.5-flash');
      expect(body.contents[0].parts[0].text).toContain('Hello World');
    });

    it('throws PROVIDER_EMPTY when Gemini returns no candidates', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockResolvedValueOnce({ status: 200, data: { candidates: [] } });
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_EMPTY' });
    });

    it('throws PROVIDER_EMPTY when Gemini returns empty text', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockResolvedValueOnce(geminiResp(''));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_EMPTY' });
    });
  });

  // ───────── translateSrt — NVIDIA ─────────
  describe('translateSrt (NVIDIA)', () => {
    it('translates a valid SRT through the NVIDIA default model with Bearer auth', async () => {
      const validSrt = srt(cue(1, 'Hello'));
      axiosMock.post.mockResolvedValueOnce(nvidiaResp('Merhaba'));
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key');
      expect(result).toContain('Merhaba');
      const [url, body, cfg] = axiosMock.post.mock.calls[0];
      expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
      expect(body.model).toBe('meta/llama-3.3-70b-instruct');
      expect(cfg.headers['Authorization']).toBe('Bearer key');
    });

    it('throws PROVIDER_EMPTY when NVIDIA returns no choices', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockResolvedValueOnce({ status: 200, data: { choices: [] } });
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_EMPTY' });
    });

    it('throws PROVIDER_EMPTY when NVIDIA returns empty content', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockResolvedValueOnce(nvidiaResp(''));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_EMPTY' });
    });
  });

  // ───────── translateSrt — slice count recovery ─────────
  describe('translateSrt — slice count recovery', () => {
    it('retries with the strict prompt when the first response has the wrong count', async () => {
      const validSrt = srt(cue(1, 'A'), cue(2, 'B'));
      axiosMock.post.mockResolvedValueOnce(geminiResp('only-one')); // 1 seg (wrong)
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['A1', 'B1']))); // 2 segs (right)
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key');
      expect(result).toContain('A1');
      expect(result).toContain('B1');
      expect(axiosMock.post).toHaveBeenCalledTimes(2);
      const strictPrompt = axiosMock.post.mock.calls[1][1].contents[0].parts[0].text;
      expect(strictPrompt).toContain('wrong number of segments');
    });

    it('joins segments for a single cue when both attempts return the wrong count', async () => {
      const validSrt = srt(cue(1, 'orig'));
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['a', 'b'])));
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['a', 'b'])));
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key');
      expect(result).toContain('a b');
    });

    it('falls back to the original text when the joined segments are empty for a single cue', async () => {
      const validSrt = srt(cue(1, 'original'));
      // '###~~~###' with no surrounding newlines splits into 2 empty segments
      axiosMock.post.mockResolvedValueOnce(geminiResp('###~~~###'));
      axiosMock.post.mockResolvedValueOnce(geminiResp('###~~~###'));
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key');
      expect(result).toContain('original');
    });

    it('recursively splits the slice when the count stays wrong after the strict retry', async () => {
      const validSrt = srt(cue(1, 'A'), cue(2, 'B'), cue(3, 'C'), cue(4, 'D'));
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['x', 'x', 'x']))); // 3 (wrong)
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['x', 'x', 'x']))); // 3 (wrong, strict)
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['L1', 'L2']))); // left 2 (right)
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['R1', 'R2']))); // right 2 (right)
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key');
      expect(result).toContain('L1');
      expect(result).toContain('L2');
      expect(result).toContain('R1');
      expect(result).toContain('R2');
      expect(axiosMock.post).toHaveBeenCalledTimes(4);
    });
  });

  // ───────── translateSrt — batching, pacing & progress emit ─────────
  describe('translateSrt — batching & pacing', () => {
    it('splits cues into multiple batches by MAX_CHARS_PER_BATCH and paces between them', async () => {
      const validSrt = srt(cue(1, 'x'.repeat(2500)), cue(2, 'y'.repeat(2500)));
      axiosMock.post.mockResolvedValueOnce(geminiResp('T1'));
      axiosMock.post.mockResolvedValueOnce(geminiResp('T2'));
      const emits = [];
      vi.useFakeTimers();
      try {
        const p = subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key', (e) =>
          emits.push(e)
        );
        p.catch(() => {});
        // Gemini gapMs is 7000 — advance past the pacing sleep before batch 2.
        await vi.advanceTimersByTimeAsync(9000);
        const result = await p;
        expect(result).toContain('T1');
        expect(result).toContain('T2');
        expect(axiosMock.post).toHaveBeenCalledTimes(2);
        expect(emits.some((e) => e.stage === 'translate' && e.batchTotal === 2)).toBe(true);
        expect(emits.some((e) => e.stage === 'waiting' && e.reason === 'pace')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('emits translate progress percentages as batches complete', async () => {
      const validSrt = srt(cue(1, 'A'), cue(2, 'B'));
      axiosMock.post.mockResolvedValueOnce(geminiResp(joinSegs(['A1', 'B1'])));
      const emits = [];
      await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key', (e) => emits.push(e));
      expect(emits.some((e) => e.stage === 'translate' && typeof e.percent === 'number')).toBe(
        true
      );
    });
  });

  // ───────── callProvider — error handling ─────────
  describe('callProvider — error handling (via translateSrt)', () => {
    it('throws INVALID_KEY on HTTP 401', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(401, { error: { message: 'bad key' } }));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'INVALID_KEY' });
    });

    it('throws INVALID_KEY on HTTP 403', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(403, { error: { message: 'forbidden' } }));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key')
      ).rejects.toMatchObject({ code: 'INVALID_KEY' });
    });

    it('rotates to the next model on a transient 503 then succeeds', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(503, { error: { message: 'temp' } }));
      axiosMock.post.mockResolvedValueOnce(nvidiaResp('Merhaba'));
      vi.useFakeTimers();
      try {
        const p = subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key');
        p.catch(() => {});
        await vi.advanceTimersByTimeAsync(3000);
        const result = await p;
        expect(result).toContain('Merhaba');
        expect(axiosMock.post).toHaveBeenCalledTimes(2);
        expect(axiosMock.post.mock.calls[1][1].model).toBe(
          'nvidia/llama-3.1-nemotron-70b-instruct'
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws PROVIDER_FAILED when every model fails with a transient 503', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValue(httpErr(503, { error: { message: 'temp' } }));
      vi.useFakeTimers();
      try {
        const p = subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key');
        p.catch(() => {});
        await vi.advanceTimersByTimeAsync(10000);
        await expect(p).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
        expect(axiosMock.post.mock.calls.length).toBe(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws PROVIDER_FAILED on a generic 500 with data.error.message', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(500, { error: { message: 'server boom' } }));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
    });

    it('treats ECONNRESET as transient and rotates models', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      const e = new Error('reset');
      e.code = 'ECONNRESET';
      e.response = { status: undefined, headers: {} };
      axiosMock.post.mockRejectedValueOnce(e);
      axiosMock.post.mockResolvedValueOnce(nvidiaResp('ok'));
      vi.useFakeTimers();
      try {
        const p = subtitleTranslator.translateSrt(validSrt, 'tr', 'nvidia', 'key');
        p.catch(() => {});
        await vi.advanceTimersByTimeAsync(3000);
        const result = await p;
        expect(result).toContain('ok');
        expect(axiosMock.post).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws UNKNOWN_PROVIDER for an unknown provider name without calling axios', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'madeup', 'key')
      ).rejects.toMatchObject({ code: 'UNKNOWN_PROVIDER' });
      expect(axiosMock.post).not.toHaveBeenCalled();
    });
  });

  // ───────── extractApiMessage branches (PROVIDER_FAILED messages) ─────────
  describe('extractApiMessage (via PROVIDER_FAILED)', () => {
    it('returns the outright string body', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(500, 'outright failure'));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_FAILED', message: 'outright failure' });
    });

    it('returns data.message when there is no error object', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(500, { message: 'msg-only' }));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_FAILED', message: 'msg-only' });
    });

    it('returns data.detail when neither error nor message is present', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValueOnce(httpErr(500, { detail: 'det-err' }));
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_FAILED', message: 'det-err' });
    });

    it('falls back to err.message when response data is missing', async () => {
      const validSrt = srt(cue(1, 'Hi'));
      const e = new Error('network down');
      e.response = { status: 500, headers: {} };
      axiosMock.post.mockRejectedValueOnce(e);
      await expect(
        subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key')
      ).rejects.toMatchObject({ code: 'PROVIDER_FAILED', message: 'network down' });
    });
  });

  // ───────── parseRetryDelayMs (429 retry branches) ─────────
  // ───────── edge branches ─────────
  describe('edge branches', () => {
    it('covers the !metadata?.streams guard in countSubtitleStreams', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, null));
      ffmpegMock.mockReturnValue(makeChain());
      await subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'en');
      const chain = ffmpegMock.mock.results[0].value;
      expect(chain.outputOptions).toHaveBeenCalledWith('-metadata:s:s:0', 'language=eng');
    });

    it('skips tmp cleanup on embed error when the temp file does not exist', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, { streams: [] }));
      fs.existsSync.mockReturnValue(false);
      ffmpegMock.mockReturnValue(makeChain({ error: new Error('mux failed') }));
      await expect(
        subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'en')
      ).rejects.toMatchObject({ code: 'EMBED_FAILED' });
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('swallows a thrown unlinkSync during embed-error cleanup', async () => {
      ffprobeMock.mockImplementation((_p, cb) => cb(null, { streams: [] }));
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('locked');
      });
      ffmpegMock.mockReturnValue(makeChain({ error: new Error('mux failed') }));
      await expect(
        subtitleTranslator.embedSubtitleIntoMp4('/v/m.mp4', '/v/s.srt', 'en')
      ).rejects.toMatchObject({ code: 'EMBED_FAILED' });
    });

    it('keeps the original cue text when a translation comes back empty', async () => {
      const validSrt = srt(cue(1, 'original text'));
      // cleaned -> '' -> outputs [''] (length matches inputs) -> success path
      axiosMock.post.mockResolvedValueOnce(geminiResp(withBeginEnd('')));
      const result = await subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key');
      expect(result).toContain('original text');
    });
  });
  describe('parseRetryDelayMs (via 429 rate-limit retry)', () => {
    const run429 = async (err) => {
      const validSrt = srt(cue(1, 'Hi'));
      axiosMock.post.mockRejectedValue(err); // persistent 429
      const emits = [];
      vi.useFakeTimers();
      try {
        const p = subtitleTranslator.translateSrt(validSrt, 'tr', 'gemini', 'key', (e) =>
          emits.push(e)
        );
        p.catch(() => {}); // absorb rejection until expect(p).rejects runs
        await vi.advanceTimersByTimeAsync(1500); // fire the first countdown tick
        await vi.advanceTimersByTimeAsync(700000); // exhaust all 6 retries
        await expect(p).rejects.toMatchObject({ code: 'RATE_LIMITED' });
        return emits;
      } finally {
        vi.useRealTimers();
      }
    };

    const maxRetryInForAttempt = (emits, attempt) => {
      const xs = emits
        .filter((e) => e.reason === 'rate_limit' && e.attempt === attempt)
        .map((e) => e.retryIn);
      return xs.length ? Math.max(...xs) : 0;
    };

    it('parses RetryInfo.retryDelay from the error details', async () => {
      const err = httpErr(429, {
        error: {
          message: 'slow down',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '5s' }],
        },
      });
      const emits = await run429(err);
      // delay = ceil(5000) + 500 = 5500ms -> first countdown tick = ceil(5500/1000) = 6
      expect(maxRetryInForAttempt(emits, 1)).toBe(6);
    });

    it('parses a "retry in Ns" message', async () => {
      const err = httpErr(429, { error: { message: 'Please retry in 7s' } });
      const emits = await run429(err);
      // delay = ceil(7000) + 500 = 7500ms -> first tick = 8
      expect(maxRetryInForAttempt(emits, 1)).toBe(8);
    });

    it('parses the Retry-After header', async () => {
      const err = httpErr(429, { error: { message: 'rate' } });
      err.response.headers['retry-after'] = '3';
      const emits = await run429(err);
      // delay = ceil(3000) + 500 = 3500ms -> first tick = 4
      expect(maxRetryInForAttempt(emits, 1)).toBe(4);
    });

    it('uses exponential backoff when no retry hint is present', async () => {
      const err = httpErr(429, { error: { message: 'rate limit' } });
      const emits = await run429(err);
      // attempt 1 default = min(120000, 15000 * 2^0) = 15000ms -> first tick = 15
      expect(maxRetryInForAttempt(emits, 1)).toBe(15);
    });
  });
});
