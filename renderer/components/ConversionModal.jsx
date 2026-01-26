import React, { useState, useEffect } from 'react';
import { FaSpinner, FaExclamationTriangle, FaCheck, FaTimes } from 'react-icons/fa';

const ConversionModal = ({ filePath, onClose, onStart }) => {
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState(null);
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [burnWarning, setBurnWarning] = useState(null);
    useEffect(() => {
        let isMounted = true;
        const analyzeFile = async () => {
            try {
                const result = await window.ipcRenderer.invoke('media:analyze', filePath);
                if (isMounted) {
                    setAnalysis(result);
                    const defaults = result.subtitles
                        .filter(s => ['tur', 'eng', 'und'].includes(s.language))
                        .map(s => s.index);
                    setSelectedIndices(defaults);
                    checkBurnWarning(defaults, result.subtitles);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Analiz hatası:", error);
                if (isMounted) setLoading(false);
            }
        };
        analyzeFile();
        return () => { isMounted = false; };
    }, [filePath]);
    const toggleSubtitle = (sub) => {
        const isSelected = selectedIndices.includes(sub.index);
        let newIndices;
        if (isSelected) {
            newIndices = selectedIndices.filter(i => i !== sub.index);
        } else {
            newIndices = [...selectedIndices, sub.index];
        }
        
        setSelectedIndices(newIndices);
        checkBurnWarning(newIndices, analysis.subtitles);
    };
    const checkBurnWarning = (indices, allSubs) => {
        const selectedSubs = allSubs.filter(s => indices.includes(s.index));
        const hasPGS = selectedSubs.find(s => s.type === 'pgs' || s.type === 'vobsub');
        
        if (hasPGS) {
            setBurnWarning(`Dikkat: "${hasPGS.language.toUpperCase()}" altyazısı resim tabanlıdır (PGS). Bu altyazıyı seçerseniz videoya gömülecektir (Burn-in) ve işlem uzun sürecektir.`);
        } else {
            setBurnWarning(null);
        }
    };

    const handleStart = () => {
        onStart({
            selectedIndices,
            burnIndex: null 
        });
    };
    if (loading) return (
        <div style={styles.overlay}>
            <div style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaSpinner className="icon-spin" /> 
            </div>
            <style>{`.icon-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={styles.overlay}>
            <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                    <h3 style={{ margin: 0 }}>Conversion Settings</h3>
                    <button onClick={onClose} style={styles.closeBtn}><FaTimes /></button>
                </div>
                <div style={styles.modalBody}>
                    <p style={styles.fileInfo}>
                        File: <span style={{ color: '#aaa' }}>{analysis?.filename.split(/[\\/]/).pop()}</span>
                    </p>
                    
                    <div style={styles.sectionTitle}>Select subtitile</div>
                    
                    <div style={styles.subtitleList}>
                        {analysis?.subtitles.length === 0 && (
                            <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                               No subtitle found.
                            </p>
                        )}
                        
                        {analysis?.subtitles.map(sub => {
                            const isSelected = selectedIndices.includes(sub.index);
                            return (
                                <div 
                                    key={sub.index} 
                                    style={{
                                        ...styles.subtitleItem,
                                        backgroundColor: isSelected ? '#2a3a4a' : 'transparent'
                                    }}
                                    onClick={() => toggleSubtitle(sub)}
                                >
                                    <div style={{
                                        ...styles.checkbox,
                                        borderColor: isSelected ? '#4ade80' : '#555',
                                        color: '#4ade80'
                                    }}>
                                        {isSelected && <FaCheck size={12} />}
                                    </div>
                                    <div style={styles.subInfo}>
                                        <span style={styles.lang}>{sub.language.toUpperCase()}</span>
                                        <span style={styles.type}>{sub.type}</span>
                                        {sub.title && <span style={styles.title}>({sub.title})</span>}
                                        {sub.isForced && <span style={styles.forcedBadge}>Forced</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {burnWarning && (
                        <div style={styles.warningBox}>
                            <FaExclamationTriangle size={20} style={{ minWidth: '20px' }} />
                            <p style={{ margin: 0 }}>{burnWarning}</p>
                        </div>
                    )}
                </div>
                <div style={styles.modalFooter}>
                    <button onClick={onClose} style={styles.btnCancel}>İptal</button>
                    <button 
                        onClick={handleStart} 
                        style={{
                            ...styles.btnConfirm,
                            backgroundColor: burnWarning ? '#eab308' : '#e50914', 
                            color: burnWarning ? '#000' : '#fff'
                        }}
                    >
                        {burnWarning ? 'Onayla (Yavaş İşlem)' : 'Hızlı Dönüştür'}
                    </button>
                </div>
            </div>
        </div>
    );
};
const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
        width: '500px',
        borderRadius: '12px',
        border: '1px solid #333',
        color: '#fff',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        fontFamily: 'Segoe UI, sans-serif',
    },
    modalHeader: {
        padding: '15px 20px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#151515',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#aaa',
        cursor: 'pointer',
        fontSize: '16px',
        padding: '5px',
    },
    modalBody: {
        padding: '20px',
    },
    fileInfo: {
        marginBottom: '15px',
        fontSize: '0.9rem',
        color: '#fff',
    },
    sectionTitle: {
        fontSize: '0.85rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#888',
        marginBottom: '10px',
        fontWeight: 'bold',
    },
    subtitleList: {
        maxHeight: '250px',
        overflowY: 'auto',
        border: '1px solid #333',
        borderRadius: '8px',
        backgroundColor: '#111',
    },
    subtitleItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 15px',
        cursor: 'pointer',
        borderBottom: '1px solid #222',
        transition: 'background 0.2s',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        border: '2px solid #555',
        borderRadius: '4px',
        marginRight: '15px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
    },
    lang: {
        fontWeight: 'bold',
        color: '#fff',
    },
    type: {
        fontSize: '0.75rem',
        backgroundColor: '#444',
        padding: '2px 6px',
        borderRadius: '4px',
        color: '#ccc',
        textTransform: 'uppercase',
    },
    title: {
        color: '#888',
        fontStyle: 'italic',
        fontSize: '0.9rem',
    },
    forcedBadge: {
        fontSize: '0.7rem',
        backgroundColor: '#b91c1c',
        color: 'white',
        padding: '2px 5px',
        borderRadius: '3px',
    },
    warningBox: {
        marginTop: '15px',
        padding: '12px',
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '6px',
        color: '#eab308',
        display: 'flex',
        gap: '12px',
        fontSize: '0.9rem',
        alignItems: 'start',
    },
    modalFooter: {
        padding: '15px 20px',
        backgroundColor: '#111',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        borderTop: '1px solid #333',
    },
    btnCancel: {
        background: 'transparent',
        color: '#aaa',
        border: '1px solid #444',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
    },
    btnConfirm: {
        border: 'none',
        padding: '8px 20px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'background 0.2s',
    }
};

export default ConversionModal;