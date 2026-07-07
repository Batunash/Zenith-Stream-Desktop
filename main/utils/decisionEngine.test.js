const { decideProcessingStrategy } = require('./decisionEngine');

describe('decisionEngine', () => {
    it('returns copy for h264 and aac without subtitles to burn', () => {
        const analysis = {
            video: { codec: 'h264' },
            audio: [{ codec: 'aac' }],
            subtitles: []
        };
        const strategy = decideProcessingStrategy(analysis);
        expect(strategy.requiresReEncode).toBe(false);
        expect(strategy.video.action).toBe('copy');
        expect(strategy.audio.action).toBe('copy');
    });

    it('requires re-encode if video codec is not h264', () => {
        const analysis = {
            video: { codec: 'hevc' },
            audio: [{ codec: 'aac' }],
            subtitles: []
        };
        const strategy = decideProcessingStrategy(analysis);
        expect(strategy.requiresReEncode).toBe(true);
        expect(strategy.video.action).toBe('encode');
        expect(strategy.video.codec).toBe('libx264');
    });

    it('re-encodes audio if not aac', () => {
        const analysis = {
            video: { codec: 'h264' },
            audio: [{ codec: 'ac3' }],
            subtitles: []
        };
        const strategy = decideProcessingStrategy(analysis);
        expect(strategy.audio.action).toBe('encode');
        expect(strategy.audio.codec).toBe('aac');
    });

    it('requires re-encode and burns subtitle if pgs is present', () => {
        const analysis = {
            video: { codec: 'h264' },
            audio: [{ codec: 'aac' }],
            subtitles: [{ index: 2, type: 'pgs', language: 'eng' }]
        };
        const strategy = decideProcessingStrategy(analysis);
        expect(strategy.requiresReEncode).toBe(true);
        expect(strategy.subtitles[0].action).toBe('burn');
    });

    it('sets externalSubtitle if provided in userOptions', () => {
        const analysis = { video: { codec: 'h264' }, audio: [{ codec: 'aac' }], subtitles: [] };
        const strategy = decideProcessingStrategy(analysis, { externalSubtitle: 'test.srt' });
        expect(strategy.externalSubtitle).toBe('test.srt');
    });

    it('filters subtitles by selectedIndices', () => {
        const analysis = {
            video: { codec: 'h264' },
            audio: [{ codec: 'aac' }],
            subtitles: [
                { index: 1, type: 'subrip', language: 'eng' },
                { index: 2, type: 'subrip', language: 'tur' }
            ]
        };
        const strategy = decideProcessingStrategy(analysis, { selectedIndices: [2] });
        expect(strategy.subtitles.length).toBe(1);
        expect(strategy.subtitles[0].index).toBe(2);
        // also triggers the soft_convert branch
        expect(strategy.subtitles[0].action).toBe('soft_convert');
    });

    it('soft converts subtitles if not pgs/vobsub and not burnIndex', () => {
        const analysis = {
            video: { codec: 'h264' },
            audio: [{ codec: 'aac' }],
            subtitles: [
                { index: 1, type: 'subrip', language: 'eng', title: 'English' }
            ]
        };
        const strategy = decideProcessingStrategy(analysis);
        expect(strategy.subtitles[0].action).toBe('soft_convert');
        expect(strategy.subtitles[0].targetCodec).toBe('mov_text');
        expect(strategy.subtitles[0].title).toBe('English');
    });
});
