import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./ffmpegHelper');

describe('mediaAnalyzer', () => {
  let mediaAnalyzer;
  let ffprobeMock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // We import ffmpegHelper to mock its properties
    const ffmpegHelper = require('./ffmpegHelper');
    ffprobeMock = vi.fn();
    ffmpegHelper.ffprobe = ffprobeMock;

    mediaAnalyzer = require('./mediaAnalyzer');
  });

  it('correctly parses video, audio, and subtitle streams', async () => {
    const mockMetadata = {
      format: {
        format_name: 'matroska,webm',
        duration: 120.5,
      },
      streams: [
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'hevc',
          width: 1920,
          height: 1080,
          avg_frame_rate: '24000/1001',
          duration: 120.5,
        },
        {
          index: 1,
          codec_type: 'audio',
          codec_name: 'aac',
          channels: 2,
          tags: { language: 'jpn', title: 'Stereo' },
        },
        {
          index: 2,
          codec_type: 'subtitle',
          codec_name: 'subrip',
          tags: { language: 'eng' },
          disposition: { forced: 0 },
        },
      ],
    };

    ffprobeMock.mockImplementation((path, callback) => {
      callback(null, mockMetadata);
    });

    const result = await mediaAnalyzer.analyzeFile('dummy.mkv');

    expect(result.container).toBe('matroska,webm');
    expect(result.duration).toBe(120.5);

    expect(result.video).toBeDefined();
    expect(result.video.codec).toBe('hevc');
    expect(result.video.resolution).toBe('1920x1080');

    expect(result.audio).toHaveLength(1);
    expect(result.audio[0].language).toBe('jpn');

    expect(result.subtitles).toHaveLength(1);
    expect(result.subtitles[0].type).toBe('srt');
    expect(result.subtitles[0].language).toBe('eng');
    expect(result.subtitles[0].isForced).toBe(false);
  });

  it('handles ffprobe errors', async () => {
    ffprobeMock.mockImplementation((path, callback) => {
      callback(new Error('ffprobe error'), null);
    });

    await expect(mediaAnalyzer.analyzeFile('error.mkv')).rejects.toThrowError(/ffprobe error/);
  });
});
