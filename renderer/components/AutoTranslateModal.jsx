import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaSpinner, FaCheck, FaExclamationTriangle, FaLanguage, FaFire } from 'react-icons/fa';
import { TARGET_LANGUAGES } from './TranslateSubtitleForm';

const TEXT_TYPES = new Set(['srt', 'ass', 'tx3g']);

const AutoTranslateModal = ({ seriesName, episodes, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
    const [episodeConfigs, setEpisodeConfigs] = useState({});
    const [targetLang, setTargetLang] = useState('en');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentEpisode, setCurrentEpisode] = useState(null);
    const [stage, setStage] = useState(null);
    const [results, setResults] = useState([]);
    const [errorBanner, setErrorBanner] = useState(null);
    const [episodeSubtitles, setEpisodeSubtitles] = useState({});
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const initialConfigs = {};
        episodes.forEach(ep => {
            initialConfigs[ep.path] = { sourceType: 'translate', sourceIndex: null, existingPath: '' };
        });
        setEpisodeConfigs(initialConfigs);
    }, [episodes]);

    useEffect(() => {
        if (!episodes.length) return;
        setAnalyzing(true);
        const analyzeAll = async () => {
            const subsMap = {};
            for (const ep of episodes) {
                try {
                    const res = await window.api.invoke('media:analyze', ep.path);
                    if (res?.success) {
                        subsMap[ep.path] = res.data.subtitles || [];
                    }
                } catch (err) {
                    console.error('[AutoTranslate] analyze error for', ep.name, err);
                    subsMap[ep.path] = [];
                }
            }
            setEpisodeSubtitles(subsMap);
            setAnalyzing(false);
        };
        analyzeAll();
    }, [episodes]);

    const toggleSelectAll = () => {
        if (selectedEpisodes.size === episodes.length) {
            setSelectedEpisodes(new Set());
        } else {
            setSelectedEpisodes(new Set(episodes.map(e => e.path)));
        }
    };

    const toggleEpisode = (path) => {
        const next = new Set(selectedEpisodes);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setSelectedEpisodes(next);
    };

    const updateConfig = (path, key, value) => {
        setEpisodeConfigs(prev => ({
            ...prev,
            [path]: { ...prev[path], [key]: value }
        }));
    };

    const handleBrowseSrt = async (path) => {
        const filePath = await window.api.invoke('dialog:openSubtitleFile');
        if (filePath) updateConfig(path, 'existingPath', filePath);
    };

    const handleStart = async () => {
        if (selectedEpisodes.size === 0) {
            setErrorBanner(t('auto_translate.no_episodes'));
            return;
        }
        setErrorBanner(null);
        setResults([]);
        setBusy(true);
        setProgress(0);
        setStage('analyzing');

        const selectedList = episodes.filter(e => selectedEpisodes.has(e.path));
        const done = [];

        for (let i = 0; i < selectedList.length; i++) {
            const ep = selectedList[i];
            const cfg = episodeConfigs[ep.path];
            setCurrentEpisode(ep.name);
            setStage(cfg.sourceType === 'translate' ? 'translating' : 'converting');
            setProgress(Math.round((i / selectedList.length) * 100));

            let srtPath = null;

            try {
                if (cfg.sourceType === 'translate') {
                    const analysis = await window.api.invoke('media:analyze', ep.path);
                    if (!analysis?.success) throw new Error('Failed to analyze video');

                    const textSubs = analysis.data.subtitles.filter(s => TEXT_TYPES.has(s.type));
                    if (!textSubs.length) throw new Error('No text-based subtitles found');

                    const sourceIdx = cfg.sourceIndex !== null ? cfg.sourceIndex : textSubs[0].index;
                    const sourceSub = textSubs.find(s => s.index === sourceIdx) || textSubs[0];

                    const targetMeta = TARGET_LANGUAGES.find(l => l.code === targetLang);
                    const res = await window.api.invoke('media:translateSubtitle', {
                        videoPath: ep.path,
                        streamIndex: sourceSub.index,
                        sourceCodec: sourceSub.codec,
                        targetLang,
                        targetLangName: targetMeta?.name || targetLang
                    });

                    if (!res.success) throw new Error(res.error || 'Translation failed');
                    srtPath = res.srtPath;
                } else {
                    if (!cfg.existingPath || !cfg.existingPath.trim()) {
                        throw new Error('No existing SRT file specified');
                    }
                    srtPath = cfg.existingPath;
                }

                setStage('converting');
                const processRes = await window.api.invoke('media:process', {
                    filePath: ep.path,
                    userPreferences: {
                        selectedIndices: [],
                        externalSubtitle: srtPath
                    }
                });

                if (!processRes.success) throw new Error(processRes.error || 'Conversion failed');

                done.push({ path: ep.path, name: ep.name, success: true });
            } catch (err) {
                console.error('[AutoTranslate] error for', ep.name, err);
                done.push({ path: ep.path, name: ep.name, success: false, error: err.message });
            }

            setProgress(Math.round(((i + 1) / selectedList.length) * 100));
        }

        setResults(done);
        setStage('done');
        setCurrentEpisode(null);
        setBusy(false);
    };

    const styles = buildStyles();

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0 }}>{t('auto_translate.title')}</h3>
                    <button style={styles.closeBtn} onClick={onClose}><FaTimes /></button>
                </div>
                <div style={styles.body}>
                    <p style={styles.seriesInfo}>{seriesName}</p>

                    <div style={styles.controls}>
                        <div style={styles.controlRow}>
                            <label style={styles.label}>{t('auto_translate.target_lang')}</label>
                            <select
                                style={styles.select}
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                disabled={busy}
                            >
                                {TARGET_LANGUAGES.map(l => (
                                    <option key={l.code} value={l.code}>{l.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            style={styles.selectAllBtn}
                            onClick={toggleSelectAll}
                            disabled={busy}
                        >
                            {selectedEpisodes.size === episodes.length
                                ? t('auto_translate.deselect_all')
                                : t('auto_translate.select_all')}
                        </button>
                    </div>

                    <div style={styles.episodeList}>
                        {analyzing && (
                            <div style={styles.analyzing}>
                                <FaSpinner className="icon-spin" />
                                <span>{t('auto_translate.analyzing')}</span>
                            </div>
                        )}
                        {!analyzing && episodes.map((ep, idx) => {
                            const cfg = episodeConfigs[ep.path] || {};
                            const isSelected = selectedEpisodes.has(ep.path);
                            const result = results.find(r => r.path === ep.path);

                            return (
                                <div key={ep.path} style={styles.episodeRow}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleEpisode(ep.path)}
                                        disabled={busy}
                                        style={styles.checkbox}
                                    />
                                    <div style={styles.epInfo}>
                                        <span style={styles.epName}>{ep.name}</span>
                                        <span style={styles.epSize}>
                                            {(ep.size / (1024 * 1024)).toFixed(1)} MB
                                        </span>
                                    </div>
                                    <select
                                        style={styles.sourceSelect}
                                        value={cfg.sourceType || 'translate'}
                                        onChange={(e) => updateConfig(ep.path, 'sourceType', e.target.value)}
                                        disabled={busy}
                                    >
                                        <option value="translate">{t('auto_translate.source_translate')}</option>
                                        <option value="existing">{t('auto_translate.source_existing')}</option>
                                    </select>
                                    {cfg.sourceType === 'translate' && (
                                        <select
                                            style={styles.subSelect}
                                            value={cfg.sourceIndex ?? ''}
                                            onChange={(e) => updateConfig(ep.path, 'sourceIndex', e.target.value === '' ? null : Number(e.target.value))}
                                            disabled={busy}
                                        >
                                            <option value="">— {t('auto_translate.select_source')} —</option>
                                            {(episodeSubtitles[ep.path] || []).filter(s => TEXT_TYPES.has(s.type)).map(s => (
                                                <option key={s.index} value={s.index}>
                                                    {s.language.toUpperCase()} · {s.type}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {cfg.sourceType === 'existing' && (
                                        <div style={styles.existingRow}>
                                            <input
                                                style={styles.existingInput}
                                                value={cfg.existingPath || ''}
                                                onChange={(e) => updateConfig(ep.path, 'existingPath', e.target.value)}
                                                placeholder={t('auto_translate.existing_placeholder')}
                                                disabled={busy}
                                            />
                                            <button
                                                style={styles.browseBtn}
                                                onClick={() => handleBrowseSrt(ep.path)}
                                                disabled={busy}
                                            >
                                                {t('common.select')}
                                            </button>
                                        </div>
                                    )}
                                    {result && (
                                        <div style={result.success ? styles.successIcon : styles.errorIcon}>
                                            {result.success ? <FaCheck /> : <FaExclamationTriangle />}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {errorBanner && (
                        <div style={styles.warning}>
                            <FaExclamationTriangle />
                            <span>{errorBanner}</span>
                        </div>
                    )}

                    {busy && (
                        <div style={styles.progress}>
                            <FaSpinner className="icon-spin" />
                            <span style={{ flex: 1 }}>
                                {stage === 'analyzing' && t('auto_translate.analyzing')}
                                {stage === 'translating' && t('auto_translate.progress_translating', { episode: currentEpisode })}
                                {stage === 'converting' && t('auto_translate.progress_converting', { episode: currentEpisode })}
                                {stage === 'done' && t('auto_translate.done')}
                            </span>
                            <div style={styles.bar}>
                                <div style={{ ...styles.barFill, width: `${progress}%` }} />
                            </div>
                        </div>
                    )}

                    {results.length > 0 && !busy && (
                        <div style={styles.summary}>
                            <span>{t('auto_translate.summary', { total: results.length, success: results.filter(r => r.success).length })}</span>
                        </div>
                    )}

                    <div style={styles.footer}>
                        <button style={styles.cancelBtn} onClick={onClose} disabled={busy}>
                            {t('common.cancel')}
                        </button>
                        <button
                            style={styles.startBtn}
                            onClick={handleStart}
                            disabled={busy || selectedEpisodes.size === 0}
                        >
                            <FaFire />
                            <span style={{ marginLeft: 6 }}>{t('auto_translate.start_batch')}</span>
                        </button>
                    </div>
                </div>
            </div>
            <style>{`.icon-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

const buildStyles = () => ({
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(5px)'
    },
    modal: {
        width: 700,
        maxHeight: '85vh',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 12,
        color: '#fff',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        fontFamily: 'Segoe UI, sans-serif',
        display: 'flex',
        flexDirection: 'column'
    },
    header: {
        padding: '15px 20px',
        borderBottom: '1px solid #333',
        backgroundColor: '#151515',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    closeBtn: {
        background: 'none', border: 'none', color: '#aaa',
        cursor: 'pointer', fontSize: 16, padding: 5
    },
    body: { padding: 20, overflowY: 'auto', flex: 1 },
    seriesInfo: { marginTop: 0, marginBottom: 16, color: '#888', fontSize: '0.9rem' },
    controls: {
        display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16,
        paddingBottom: 16, borderBottom: '1px solid #333'
    },
    controlRow: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: '0.75rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 },
    select: {
        padding: '8px 10px',
        backgroundColor: '#222', border: '1px solid #444',
        borderRadius: 6, color: 'white', fontSize: '0.9rem', outline: 'none'
    },
    selectAllBtn: {
        padding: '8px 16px',
        backgroundColor: '#333', color: '#ccc',
        border: '1px solid #555', borderRadius: 6,
        cursor: 'pointer', fontSize: '0.85rem'
    },
    episodeList: { display: 'flex', flexDirection: 'column', gap: 8 },
    analyzing: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 20, color: '#ccc', fontSize: '0.9rem'
    },
    episodeRow: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 10, backgroundColor: '#111',
        border: '1px solid #222', borderRadius: 6
    },
    checkbox: { width: 16, height: 16, cursor: 'pointer' },
    epInfo: { flex: 1, minWidth: 0 },
    epName: { fontSize: '0.9rem', fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    epSize: { fontSize: '0.75rem', color: '#666' },
    sourceSelect: {
        padding: '6px 8px', backgroundColor: '#222', border: '1px solid #444',
        borderRadius: 4, color: 'white', fontSize: '0.8rem', outline: 'none', width: 140
    },
    subSelect: {
        padding: '6px 8px', backgroundColor: '#222', border: '1px solid #444',
        borderRadius: 4, color: 'white', fontSize: '0.8rem', outline: 'none', width: 140
    },
    existingRow: { display: 'flex', gap: 6, alignItems: 'center' },
    existingInput: {
        flex: 1, minWidth: 0, padding: '6px 8px',
        backgroundColor: '#222', border: '1px solid #444',
        borderRadius: 4, color: 'white', fontSize: '0.8rem', outline: 'none'
    },
    browseBtn: {
        padding: '6px 10px', backgroundColor: '#333', color: '#ccc',
        border: '1px solid #555', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem'
    },
    successIcon: { color: '#4ade80', fontSize: '1rem' },
    errorIcon: { color: '#ef4444', fontSize: '1rem' },
    warning: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 10, backgroundColor: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 6,
        color: '#eab308', fontSize: '0.85rem', marginTop: 12
    },
    progress: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 12, backgroundColor: '#111', border: '1px solid #333',
        borderRadius: 6, marginTop: 12, color: '#ccc', fontSize: '0.85rem'
    },
    bar: { flex: 1, height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: '#4ade80', transition: 'width 0.3s ease' },
    summary: {
        padding: 10, backgroundColor: 'rgba(74, 222, 128, 0.1)',
        border: '1px solid rgba(74, 222, 128, 0.3)', borderRadius: 6,
        color: '#4ade80', fontSize: '0.85rem', marginTop: 12
    },
    footer: {
        display: 'flex', justifyContent: 'flex-end', gap: 10,
        marginTop: 16, paddingTop: 16, borderTop: '1px solid #333'
    },
    cancelBtn: {
        padding: '10px 20px', backgroundColor: 'transparent',
        color: '#aaa', border: '1px solid #444', borderRadius: 6,
        cursor: 'pointer', fontSize: '0.9rem'
    },
    startBtn: {
        padding: '10px 24px', backgroundColor: '#e50914',
        color: 'white', border: 'none', borderRadius: 6,
        cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold',
        display: 'flex', alignItems: 'center'
    }
});

export default AutoTranslateModal;
