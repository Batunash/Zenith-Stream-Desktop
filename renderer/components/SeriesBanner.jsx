import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaLanguage } from 'react-icons/fa';

const SeriesBanner = ({ metadata, seasonCount, onBack, onAutoTranslate }) => {
  const { t } = useTranslation();
  const backdropUrl = metadata?.backdrop 
    ? (metadata.backdrop.startsWith('http') ? metadata.backdrop : `media://${metadata.fullPosterPath}`) 
    : `media://${metadata?.fullPosterPath}`;

  return (
    <div style={styles.bannerContainer}>
      <div style={{...styles.bannerImage, backgroundImage: `url('${backdropUrl}')`}}></div>
      <div style={styles.bannerOverlay}></div>
      
      <div style={styles.headerContent}>
          <button onClick={onBack} style={styles.backBtn}>&larr; {t('common.back')}</button>
          <h1 style={styles.title}>{metadata?.title}</h1>
          <div style={styles.metaBadges}>
              <span style={styles.badge}>IMDB: {metadata?.rating}</span>
              <span style={styles.badge}>{seasonCount} {t('detail.seasons')}</span>
              {onAutoTranslate && (
                  <button style={styles.autoTranslateBtn} onClick={onAutoTranslate}>
                      <FaLanguage />
                      <span style={{ marginLeft: 6 }}>{t('auto_translate.button')}</span>
                  </button>
              )}
          </div>
          <p style={styles.overview}>{metadata?.overview}</p>
      </div>
    </div>
  );
};

const styles = {
  bannerContainer: { position: 'relative', height: '40vh', width: '100%' },
  bannerImage: { width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.6 },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(18,18,18,0) 0%, rgba(18,18,18,1) 100%)' },
  headerContent: { position: 'absolute', bottom: '20px', left: '40px', right: '40px', zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem', marginBottom: 10 },
  title: { fontSize: '3rem', margin: '0 0 10px 0', textShadow: '0 2px 10px rgba(0,0,0,0.8)' },
  metaBadges: { display: 'flex', gap: '10px', marginBottom: '15px' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.9rem', backdropFilter: 'blur(5px)' },
  autoTranslateBtn: {
    backgroundColor: 'rgba(234, 179, 8, 0.3)',
    border: '1px solid rgba(234, 179, 8, 0.5)',
    color: '#eab308',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    backdropFilter: 'blur(5px)'
  },
  overview: { maxWidth: '800px', lineHeight: '1.6', color: '#ddd', fontSize: '1rem', textShadow: '0 1px 5px rgba(0,0,0,0.8)' },
};

export default SeriesBanner;