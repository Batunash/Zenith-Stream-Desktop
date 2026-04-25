import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import TranslateSubtitleForm from './TranslateSubtitleForm';

const TranslateSubtitleModal = ({ videoPath, presetAnalysis = null, onClose }) => {
    const { t } = useTranslation();
    const [analysis, setAnalysis] = useState(presetAnalysis);
    const [loading, setLoading] = useState(!presetAnalysis);

    useEffect(() => {
        if (presetAnalysis) return;
        let mounted = true;
        (async () => {
            try {
                const res = await window.api.invoke('media:analyze', videoPath);
                if (!mounted) return;
                if (res?.success) setAnalysis(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [videoPath, presetAnalysis]);

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0 }}>{t('translate.title')}</h3>
                    <button style={styles.closeBtn} onClick={onClose}><FaTimes /></button>
                </div>
                <div style={styles.body}>
                    <p style={styles.fileInfo}>
                        {videoPath?.split(/[\\/]/).pop()}
                    </p>
                    {loading ? (
                        <div style={styles.loading}>
                            <FaSpinner className="icon-spin" />
                            <span>{t('common.loading')}</span>
                            <style>{`.icon-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <TranslateSubtitleForm videoPath={videoPath} analysis={analysis} />
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(5px)'
    },
    modal: {
        width: 480,
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 12,
        color: '#fff',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        fontFamily: 'Segoe UI, sans-serif'
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
    body: { padding: 20 },
    fileInfo: { marginTop: 0, marginBottom: 14, color: '#aaa', fontSize: '0.85rem' },
    loading: {
        display: 'flex', alignItems: 'center', gap: 10,
        color: '#ccc', padding: '20px 0'
    }
};

export default TranslateSubtitleModal;
