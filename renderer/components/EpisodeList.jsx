import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCog, FaSpinner, FaEdit, FaLanguage } from 'react-icons/fa';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

const EpisodeList = ({
  episodes,
  activeSeason,
  onUpload,
  onDelete,
  onConvert,
  onTranslate,
  conversionState = {},
  uploadDisabled,
}) => {
  const { t } = useTranslation();
  const isCompatible = (filename) => filename.toLowerCase().endsWith('.mp4');

  const Row = ({ index, style }) => {
    const ep = episodes[index];
    const status = conversionState[ep.path];
    const isProcessing = status?.status === 'processing';
    const progress = status?.progress || 0;
    const needsConversion = !isCompatible(ep.name);

    return (
      <div style={{ ...style, paddingBottom: '10px' }}>
        <div style={styles.episodeCard}>
          <div style={styles.epIcon}>
            {isProcessing ? <FaSpinner className="icon-spin" /> : '▶'}
          </div>

          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={styles.epName}>{ep.name}</div>
            <div style={styles.epSize}>
              {(ep.size / (1024 * 1024)).toFixed(1)} MB
              {needsConversion && !isProcessing && <span style={styles.tag}>MKV/AVI</span>}
            </div>
            {isProcessing && (
              <div style={styles.progressContainer}>
                <div style={{ ...styles.progressBar, width: `${progress}%` }}></div>
                <span style={styles.progressText}>%{Math.round(progress)}</span>
              </div>
            )}
          </div>
          <div style={styles.actions}>
            {!isProcessing && (
              <button
                style={needsConversion ? styles.convertBtn : styles.editBtn}
                onClick={() => onConvert(ep)}
                title={needsConversion ? 'Convert Format' : 'Edit / Add Subtitle'}
              >
                {needsConversion ? <FaCog /> : <FaEdit />}
                {needsConversion ? ' Convert' : ' Edit'}
              </button>
            )}

            {!isProcessing && onTranslate && (
              <button
                style={styles.translateBtn}
                onClick={() => onTranslate(ep)}
                title={t('translate.tooltip')}
              >
                <FaLanguage />
              </button>
            )}

            <button
              style={styles.deleteEpBtn}
              onClick={() => onDelete(ep.path)}
              title={t('common.delete')}
              disabled={isProcessing}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.episodeSection}>
      <div style={styles.header}>
        <h3 style={{ color: 'white', margin: 0 }}>
          {t('detail.episodes_title', { season: activeSeason })}
        </h3>
        {!uploadDisabled && (
          <button style={styles.uploadBtn} onClick={onUpload}>
            {t('detail.upload_file')}
          </button>
        )}
      </div>

      {episodes.length > 0 ? (
        <div style={styles.episodeGrid}>
          <AutoSizer defaultHeight={800} defaultWidth={1000}>
            {({ height, width }) => (
                <List
                  height={height}
                  rowCount={episodes.length}
                  rowHeight={90}
                  width={width}
                  rowComponent={Row}
                />
            )}
          </AutoSizer>
        </div>
      ) : (
        <div style={styles.emptyState}>{t('detail.empty_season')}</div>
      )}
      <style>{`.icon-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const styles = {
  episodeSection: { 
    animation: 'fadeIn 0.5s',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flex: 1
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadBtn: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  episodeGrid: { flex: 1, minHeight: '400px' },
  episodeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    backgroundColor: '#1a1a1a',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #333',
    transition: 'background 0.2s',
    height: '80px',
    boxSizing: 'border-box'
  },
  epIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#aaa',
  },
  epName: { fontWeight: '500', fontSize: '1rem', marginBottom: '4px' },
  epSize: { fontSize: '0.8rem', color: '#666', display: 'flex', gap: '10px', alignItems: 'center' },
  deleteEpBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.2rem',
    opacity: 0.7,
    padding: '5px',
    transition: 'opacity 0.2s',
    color: '#fff',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#555',
    border: '2px dashed #333',
    borderRadius: '12px',
  },
  tag: {
    backgroundColor: '#eab308',
    color: 'black',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
  },
  actions: { display: 'flex', alignItems: 'center', gap: '10px' },
  convertBtn: {
    backgroundColor: '#e50914',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  editBtn: {
    backgroundColor: '#334155',
    color: 'white',
    border: '1px solid #475569',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  translateBtn: {
    backgroundColor: 'transparent',
    color: '#60a5fa',
    border: '1px solid #1e3a8a',
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    height: '4px',
    backgroundColor: '#333',
    borderRadius: '2px',
    marginTop: '8px',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: '2px',
    transition: 'width 0.2s',
  },
  progressText: {
    position: 'absolute',
    right: 0,
    top: '-15px',
    fontSize: '0.7rem',
    color: '#22c55e',
  },
};

export default EpisodeList;
