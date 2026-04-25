const ffmpeg = require('./ffmpegHelper');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

const TEXT_SUB_CODECS = new Set(['subrip', 'ass', 'ssa', 'mov_text', 'webvtt']);
const IMAGE_SUB_CODECS = new Set(['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle']);

class SubtitleError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const ISO2_TO_ISO3 = {
    en: 'eng', tr: 'tur', es: 'spa', fr: 'fre', de: 'ger',
    it: 'ita', pt: 'por', ru: 'rus', ja: 'jpn', zh: 'chi', ar: 'ara'
};
const toIso3 = (code) => ISO2_TO_ISO3[code] || code;

const extractSubtitleToSrt = (videoPath, streamIndex, sourceCodec) => {
    return new Promise((resolve, reject) => {
        if (sourceCodec && IMAGE_SUB_CODECS.has(sourceCodec)) {
            return reject(new SubtitleError('IMAGE_SUB', `Image-based subtitle (${sourceCodec}) cannot be extracted as text.`));
        }
        if (sourceCodec && !TEXT_SUB_CODECS.has(sourceCodec)) {
            return reject(new SubtitleError('UNSUPPORTED_SUB', `Unsupported subtitle codec: ${sourceCodec}`));
        }

        const tmpFile = path.join(os.tmpdir(), `zenith_sub_${Date.now()}_${streamIndex}.srt`);
        ffmpeg(videoPath)
            .outputOptions('-map', `0:${streamIndex}`)
            .outputOptions('-c:s', 'srt')
            .output(tmpFile)
            .on('end', () => {
                try {
                    const content = fs.readFileSync(tmpFile, 'utf8');
                    fs.unlinkSync(tmpFile);
                    if (!content.trim()) {
                        return reject(new SubtitleError('EMPTY_SUB', 'Extracted subtitle is empty.'));
                    }
                    resolve(content);
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', (err) => {
                if (fs.existsSync(tmpFile)) {
                    try { fs.unlinkSync(tmpFile); } catch (_) {}
                }
                reject(new SubtitleError('EXTRACT_FAILED', err.message));
            })
            .run();
    });
};

const parseSrt = (text) => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const blocks = normalized.split(/\n\n+/);
    const cues = [];
    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 2) continue;
        let i = 0;
        const idLine = lines[i].trim();
        if (/^\d+$/.test(idLine)) i++;
        const timeLine = lines[i];
        if (!timeLine || !timeLine.includes('-->')) continue;
        const textLines = lines.slice(i + 1).join('\n').trim();
        if (!textLines) continue;
        cues.push({ time: timeLine.trim(), text: textLines });
    }
    return cues;
};

const buildSrt = (cues) => {
    return cues.map((c, idx) => `${idx + 1}\n${c.time}\n${c.text}`).join('\n\n') + '\n';
};

const SEPARATOR = '\n###~~~###\n';
const SEPARATOR_RE = /\n?#{3}~{3}#{3}\n?/;
const MAX_CHARS_PER_BATCH = 4500;
const MAX_CUES_PER_BATCH = 200;
const MAX_RETRIES_429 = 6;
const MAX_RETRIES_TRANSIENT = 3;

const PROVIDER_MODELS = {
    gemini: [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash'
    ],
    nvidia: [
        'meta/llama-3.3-70b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct',
        'meta/llama-3.1-405b-instruct'
    ]
};

const PROVIDER_DEFAULTS = {
    gemini: {
        gapMs: 7000,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        label: 'Gemini'
    },
    nvidia: {
        gapMs: 16000,
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        label: 'NVIDIA'
    }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const sleepWithCountdown = async (ms, emit) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const remaining = end - Date.now();
        if (emit) emit(Math.ceil(remaining / 1000));
        await sleep(Math.min(1000, remaining));
    }
};

const parseRetryDelayMs = (err) => {
    const data = err?.response?.data;
    const details = data?.error?.details;
    if (Array.isArray(details)) {
        for (const d of details) {
            const t = d['@type'] || '';
            if (t.includes('RetryInfo') && d.retryDelay) {
                const m = String(d.retryDelay).match(/([\d.]+)s/);
                if (m) return Math.ceil(parseFloat(m[1]) * 1000) + 500;
            }
        }
    }
    const msg = (typeof data === 'string' ? data : data?.error?.message || data?.message) || '';
    const m = String(msg).match(/retry in ([\d.]+)\s*s/i);
    if (m) return Math.ceil(parseFloat(m[1]) * 1000) + 500;
    const ra = err?.response?.headers?.['retry-after'];
    if (ra) {
        const sec = parseFloat(ra);
        if (!Number.isNaN(sec)) return Math.ceil(sec * 1000) + 500;
    }
    return null;
};

const buildBatches = (cues) => {
    const batches = [];
    let current = [];
    let chars = 0;
    for (const cue of cues) {
        const len = cue.text.length;
        if (current.length && (chars + len > MAX_CHARS_PER_BATCH || current.length >= MAX_CUES_PER_BATCH)) {
            batches.push(current);
            current = [];
            chars = 0;
        }
        current.push(cue);
        chars += len;
    }
    if (current.length) batches.push(current);
    return batches;
};

const callGeminiOnce = async (prompt, apiKey, providerCfg, model) => {
    const res = await axios.post(
        `${providerCfg.baseUrl}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    const candidates = res.data?.candidates;
    if (!candidates || !candidates.length) {
        throw new SubtitleError('PROVIDER_EMPTY', 'Gemini returned no candidates.');
    }
    const parts = candidates[0]?.content?.parts || [];
    const out = parts.map(p => p.text || '').join('');
    if (!out) throw new SubtitleError('PROVIDER_EMPTY', 'Gemini returned empty text.');
    return { text: out, status: res.status };
};

const callNvidiaOnce = async (prompt, apiKey, providerCfg, model) => {
    const res = await axios.post(
        providerCfg.url,
        {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 4000,
            stream: false
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            timeout: 120000
        }
    );
    const choices = res.data?.choices;
    if (!choices || !choices.length) {
        throw new SubtitleError('PROVIDER_EMPTY', 'NVIDIA returned no choices.');
    }
    const out = choices[0]?.message?.content || '';
    if (!out) throw new SubtitleError('PROVIDER_EMPTY', 'NVIDIA returned empty text.');
    return { text: out, status: res.status };
};

const PROVIDER_CALLS = {
    gemini: callGeminiOnce,
    nvidia: callNvidiaOnce
};

const extractApiMessage = (err) => {
    const data = err?.response?.data;
    if (!data) return err?.message;
    if (typeof data === 'string') return data;
    return data.error?.message || data.message || data.detail || err?.message;
};

const callProvider = async (prompt, providerName, apiKey, emit) => {
    const providerCfg = PROVIDER_DEFAULTS[providerName];
    if (!providerCfg) throw new SubtitleError('UNKNOWN_PROVIDER', `Unknown provider: ${providerName}`);
    const fn = PROVIDER_CALLS[providerName];
    const models = PROVIDER_MODELS[providerName] || [providerName];
    let modelIdx = 0;
    let attempt = 0;

    while (true) {
        const model = models[modelIdx];
        try {
            const t0 = Date.now();
            const { text, status } = await fn(prompt, apiKey, providerCfg, model);
            console.log(`[Translate] ${providerCfg.label} ${model} ${status} in ${Date.now() - t0}ms`);
            return text;
        } catch (err) {
            if (err instanceof SubtitleError) throw err;
            const status = err.response?.status;
            const code = err.code;
            const apiMsg = extractApiMessage(err);
            const isTransient = status === 502 || status === 503 || status === 504 || code === 'ETIMEDOUT' || code === 'ECONNRESET';

            if (status === 429 && attempt < MAX_RETRIES_429) {
                attempt++;
                const apiDelay = parseRetryDelayMs(err);
                const wait = apiDelay || Math.min(120000, 15000 * Math.pow(2, attempt - 1));
                console.warn(`[Translate] ${providerCfg.label} ${model} 429 (attempt ${attempt}/${MAX_RETRIES_429}). Waiting ${Math.round(wait / 1000)}s. API: ${apiMsg}`);
                await sleepWithCountdown(wait, (sec) => {
                    if (emit) emit({ stage: 'waiting', reason: 'rate_limit', retryIn: sec, attempt });
                });
                continue;
            }

            if (isTransient && modelIdx < models.length - 1) {
                modelIdx++;
                console.warn(`[Translate] ${providerCfg.label} ${model} failed (${status || code}), rotating to ${models[modelIdx]}. API: ${apiMsg}`);
                await sleep(2000);
                continue;
            }

            if (status === 401 || status === 403) {
                console.error(`[Translate] ${providerCfg.label} auth failed (${status}): ${apiMsg}`);
                throw new SubtitleError('INVALID_KEY', apiMsg || `${providerCfg.label} rejected the API key.`);
            }
            if (status === 429) {
                console.error(`[Translate] ${providerCfg.label} 429 retries exhausted: ${apiMsg}`);
                throw new SubtitleError('RATE_LIMITED', apiMsg || `${providerCfg.label} rate limit hit. Try again later.`);
            }
            console.error(`[Translate] ${providerCfg.label} ${model} HTTP ${status || '?'} error: ${apiMsg || err.message}`);
            throw new SubtitleError('PROVIDER_FAILED', apiMsg || err.message);
        }
    }
};

const translateBatch = async (texts, targetLang, providerName, apiKey, strict, emit) => {
    const stricter = strict
        ? '\nThe previous attempt returned a wrong number of segments. Output EXACTLY one translation per input segment, separated only by the exact separator. No extra text.'
        : '';
    const prompt = [
        `Translate each segment below into ${targetLang}.`,
        `Preserve segment boundaries and order. Output ONLY the translations, separated by the exact separator line: ${SEPARATOR.trim()}`,
        `Do not add commentary, numbering, or quotes. Keep line breaks within a segment as in the input.${stricter}`,
        '',
        '--- BEGIN ---',
        texts.join(SEPARATOR),
        '--- END ---'
    ].join('\n');

    const raw = await callProvider(prompt, providerName, apiKey, emit);
    const cleaned = raw
        .replace(/^---\s*BEGIN\s*---/i, '')
        .replace(/---\s*END\s*---\s*$/i, '')
        .trim();
    const parts = cleaned.split(SEPARATOR_RE).map(s => s.replace(/^\n+|\n+$/g, ''));
    return parts;
};

const translateSlice = async (slice, targetLang, providerName, apiKey, emit) => {
    const inputs = slice.map(c => c.text);

    let outputs = await translateBatch(inputs, targetLang, providerName, apiKey, false, emit);
    if (outputs.length !== inputs.length) {
        outputs = await translateBatch(inputs, targetLang, providerName, apiKey, true, emit);
    }
    if (outputs.length !== inputs.length) {
        if (slice.length === 1) {
            return [outputs.join(' ').trim() || slice[0].text];
        }
        const mid = Math.floor(slice.length / 2);
        const left = await translateSlice(slice.slice(0, mid), targetLang, providerName, apiKey, emit);
        const right = await translateSlice(slice.slice(mid), targetLang, providerName, apiKey, emit);
        return [...left, ...right];
    }
    return outputs;
};

const translateSrt = async (srtText, targetLang, providerName, apiKey, emit) => {
    const cues = parseSrt(srtText);
    if (!cues.length) {
        throw new SubtitleError('EMPTY_SUB', 'No cues found in subtitle.');
    }

    const providerCfg = PROVIDER_DEFAULTS[providerName] || PROVIDER_DEFAULTS.nvidia;
    const gapMs = providerCfg.gapMs;
    const batches = buildBatches(cues);
    console.log(`[Translate] ${providerCfg.label}: ${cues.length} cues -> ${batches.length} batches (target: ${targetLang}, gap: ${gapMs}ms)`);
    const translated = new Array(cues.length);
    let done = 0;
    let cueOffset = 0;
    let lastRequestAt = 0;

    if (emit) emit({ stage: 'translate', percent: 0, batchTotal: batches.length, batchIndex: 0 });

    for (let bi = 0; bi < batches.length; bi++) {
        const slice = batches[bi];
        const elapsed = Date.now() - lastRequestAt;
        if (lastRequestAt && elapsed < gapMs) {
            const waitMs = gapMs - elapsed;
            console.log(`[Translate] Pacing ${Math.round(waitMs / 1000)}s before batch ${bi + 1}/${batches.length}`);
            await sleepWithCountdown(waitMs, (sec) => {
                if (emit) emit({ stage: 'waiting', reason: 'pace', retryIn: sec, batchIndex: bi, batchTotal: batches.length });
            });
        }
        lastRequestAt = Date.now();

        console.log(`[Translate] Batch ${bi + 1}/${batches.length} (${slice.length} cues, ${slice.reduce((n, c) => n + c.text.length, 0)} chars)`);
        if (emit) emit({ stage: 'translate', percent: Math.round((done / cues.length) * 100), batchIndex: bi + 1, batchTotal: batches.length });

        const outputs = await translateSlice(slice, targetLang, providerName, apiKey, emit);

        for (let i = 0; i < slice.length; i++) {
            translated[cueOffset + i] = {
                time: slice[i].time,
                text: (outputs[i] || '').trim() || slice[i].text
            };
        }
        cueOffset += slice.length;
        done += slice.length;
        if (emit) emit({ stage: 'translate', percent: Math.round((done / cues.length) * 100), batchIndex: bi + 1, batchTotal: batches.length });
    }

    return buildSrt(translated);
};

const countSubtitleStreams = (videoPath) => new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err || !metadata?.streams) return resolve(0);
        resolve(metadata.streams.filter(s => s.codec_type === 'subtitle').length);
    });
});

const embedSubtitleIntoMp4 = async (mp4Path, srtPath, langCode, title) => {
    const existingSubs = await countSubtitleStreams(mp4Path);
    const newSubIdx = existingSubs;
    return new Promise((resolve, reject) => {
        const dir = path.dirname(mp4Path);
        const name = path.parse(mp4Path).name;
        const tempPath = path.join(dir, `temp_${name}_${Date.now()}.mp4`);
        const lang3 = toIso3(langCode);

        ffmpeg(mp4Path)
            .input(srtPath)
            .outputOptions('-map', '0')
            .outputOptions('-map', '1:0')
            .outputOptions('-c', 'copy')
            .outputOptions('-c:s', 'mov_text')
            .outputOptions(`-metadata:s:s:${newSubIdx}`, `language=${lang3}`)
            .outputOptions(`-metadata:s:s:${newSubIdx}`, `title=${title || langCode.toUpperCase()}`)
            .outputOptions('-movflags', '+faststart')
            .output(tempPath)
            .on('end', () => {
                try {
                    fs.unlinkSync(mp4Path);
                    fs.renameSync(tempPath, mp4Path);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', (err) => {
                if (fs.existsSync(tempPath)) {
                    try { fs.unlinkSync(tempPath); } catch (_) {}
                }
                reject(new SubtitleError('EMBED_FAILED', err.message));
            })
            .run();
    });
};

module.exports = {
    extractSubtitleToSrt,
    translateSrt,
    embedSubtitleIntoMp4,
    SubtitleError,
    TEXT_SUB_CODECS,
    IMAGE_SUB_CODECS
};
