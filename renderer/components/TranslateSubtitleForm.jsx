import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaSpinner, FaCheck, FaExclamationTriangle, FaLanguage } from 'react-icons/fa';

export const TARGET_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
];

const TEXT_TYPES = new Set(['srt', 'ass', 'tx3g']);

const TranslateSubtitleForm = ({ videoPath, analysis, compact = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [sourceIndex, setSourceIndex] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null);
  const [percent, setPercent] = useState(0);
  const [retryIn, setRetryIn] = useState(null);
  const [waitReason, setWaitReason] = useState(null);
  const [batchInfo, setBatchInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  const subtitles = analysis?.subtitles || [];
  const textSubs = subtitles.filter((s) => TEXT_TYPES.has(s.type));
  const imageSubs = subtitles.filter((s) => !TEXT_TYPES.has(s.type));

  useEffect(() => {
    if (textSubs.length && sourceIndex === '') {
      const tur = textSubs.find((s) => s.language === 'tur');
      const eng = textSubs.find((s) => s.language === 'eng');
      setSourceIndex(String((tur || eng || textSubs[0]).index));
    }
  }, [analysis]);

  useEffect(() => {
    const handler = (payload) => {
      if (!payload) return;
      setStage(payload.stage);
      if (typeof payload.percent === 'number') setPercent(payload.percent);
      if (payload.stage === 'waiting') {
        setRetryIn(payload.retryIn ?? null);
        setWaitReason(payload.reason ?? null);
      } else {
        setRetryIn(null);
        setWaitReason(null);
      }
      if (typeof payload.batchIndex === 'number' && typeof payload.batchTotal === 'number') {
        setBatchInfo({ index: payload.batchIndex, total: payload.batchTotal });
      }
    };
    window.api.receive('media:translateSubtitle:progress', handler);
    return () => window.api.remove('media:translateSubtitle:progress');
  }, []);

  const handleTranslate = async () => {
    if (!sourceIndex && sourceIndex !== 0) {
      setErrorBanner(t('translate.select_source'));
      return;
    }
    if (!targetLang) {
      setErrorBanner(t('translate.select_target'));
      return;
    }
    setErrorBanner(null);
    setResult(null);
    setBusy(true);
    setStage('extract');
    setPercent(0);
    setRetryIn(null);
    setWaitReason(null);
    setBatchInfo(null);

    const sub = subtitles.find((s) => s.index === Number(sourceIndex));
    const targetMeta = TARGET_LANGUAGES.find((l) => l.code === targetLang);

    const res = await window.api.invoke('media:translateSubtitle', {
      videoPath,
      streamIndex: Number(sourceIndex),
      sourceCodec: sub?.codec,
      targetLang,
      targetLangName: targetMeta?.name || targetLang,
    });

    setBusy(false);
    if (res.success) {
      setResult(res);
    } else if (res.code === 'NO_KEY') {
      setErrorBanner('NO_KEY');
    } else {
      setErrorBanner(res.error || t('common.error'));
    }
  };

  const stageLabel = () => {
    if (stage === 'extract') return t('translate.extracting');
    if (stage === 'waiting') {
      const key = waitReason === 'rate_limit' ? 'translate.waiting_rate' : 'translate.waiting_pace';
      return t(key, { seconds: retryIn ?? '...' });
    }
    if (stage === 'translate') {
      if (batchInfo) {
        return t('translate.translating_batch', {
          percent,
          index: batchInfo.index,
          total: batchInfo.total,
        });
      }
      return t('translate.translating', { percent });
    }
    return '';
  };

  const styles = buildStyles(compact);

  if (!subtitles.length || textSubs.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.warning}>
          <FaExclamationTriangle />
          <span>{t('translate.no_text_subs')}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <label style={styles.label}>{t('translate.source_sub')}</label>
        <select
          style={styles.select}
          value={sourceIndex}
          onChange={(e) => setSourceIndex(e.target.value)}
          disabled={busy}
        >
          <option value="">— {t('translate.select_source')} —</option>
          {textSubs.map((s) => (
            <option key={s.index} value={s.index}>
              {s.language.toUpperCase()} · {s.type}
              {s.title ? ` · ${s.title}` : ''}
            </option>
          ))}
        </select>
      </div>

      {imageSubs.length > 0 && (
        <div style={styles.hint}>
          {imageSubs.map((s) => `${s.language.toUpperCase()} (${s.type})`).join(', ')}:{' '}
          {t('translate.unsupported_pgs')}
        </div>
      )}

      <div style={styles.row}>
        <label style={styles.label}>{t('translate.target_lang')}</label>
        <select
          style={styles.select}
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          disabled={busy}
        >
          {TARGET_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.hint}>{t('translate.next_step_hint')}</div>

      {errorBanner === 'NO_KEY' ? (
        <div style={styles.warning}>
          <FaExclamationTriangle />
          <span>{t('translate.no_key_warning')}</span>
          <button style={styles.linkBtn} onClick={() => navigate('/settings')}>
            {t('translate.open_settings')}
          </button>
        </div>
      ) : errorBanner ? (
        <div style={styles.warning}>
          <FaExclamationTriangle />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      {busy && (
        <div style={styles.progress}>
          <FaSpinner className="icon-spin" />
          <span style={{ flex: 1 }}>{stageLabel()}</span>
          {(stage === 'translate' || stage === 'waiting') && (
            <div style={styles.bar}>
              <div style={{ ...styles.barFill, width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={styles.success}>
          <FaCheck color="#4ade80" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>{t('translate.success', { file: result.srtPath.split(/[\\/]/).pop() })}</span>
            <span style={{ fontSize: '0.75rem', color: '#9aa', fontStyle: 'italic' }}>
              {t('translate.next_step_hint')}
            </span>
          </div>
        </div>
      )}

      <button style={styles.btn} onClick={handleTranslate} disabled={busy}>
        <FaLanguage />
        <span style={{ marginLeft: 6 }}>{busy ? stageLabel() : t('translate.translate_btn')}</span>
      </button>

      <style>{`.icon-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const buildStyles = (compact) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? 8 : 12,
    padding: compact ? '8px 0' : '4px 0',
  },
  row: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 },
  select: {
    padding: '8px 10px',
    backgroundColor: '#222',
    border: '1px solid #444',
    borderRadius: 6,
    color: 'white',
    fontSize: '0.9rem',
    outline: 'none',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#ccc',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  hint: { fontSize: '0.75rem', color: '#888', fontStyle: 'italic' },
  btn: {
    marginTop: 4,
    padding: '10px 14px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#ccc',
    fontSize: '0.85rem',
  },
  bar: {
    flex: 1,
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    transition: 'width 0.3s ease',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    borderRadius: 6,
    color: '#eab308',
    fontSize: '0.85rem',
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.3)',
    borderRadius: 6,
    color: '#4ade80',
    fontSize: '0.85rem',
  },
  linkBtn: {
    marginLeft: 'auto',
    background: 'transparent',
    border: '1px solid #eab308',
    color: '#eab308',
    padding: '4px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
});

export default TranslateSubtitleForm;
