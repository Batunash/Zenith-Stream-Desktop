import React from 'react';
import { useTranslation } from 'react-i18next';

const SeasonList = ({ seasons, activeSeason, onSelect, onAdd, onDelete, isMovie }) => {
  const { t } = useTranslation();

  return (
    <div style={styles.seasonSection}>
      <div style={styles.seasonList}>
        {seasons.map((season) => (
          <div key={season} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              style={activeSeason === season ? styles.activeSeasonBtn : styles.seasonBtn}
              onClick={() => onSelect(season)}
            >
              {season}
            </button>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onDelete(season);
              }}
              style={styles.deleteSeasonBadge}
              title={t('common.delete')}
            ></span>
          </div>
        ))}
        {!isMovie && (
          <button style={styles.addSeasonBtn} onClick={onAdd}>
            {t('detail.new_season')}
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  seasonSection: { marginBottom: '40px' },
  seasonList: {
    display: 'flex',
    gap: '15px',
    overflowX: 'auto',
    paddingBottom: '10px',
    scrollbarWidth: 'thin',
  },
  seasonBtn: {
    padding: '10px 20px',
    backgroundColor: '#222',
    border: '1px solid #333',
    color: '#aaa',
    borderRadius: '20px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '1rem',
    transition: '0.2s',
  },
  activeSeasonBtn: {
    padding: '10px 20px',
    backgroundColor: '#e50914',
    border: '1px solid #e50914',
    color: 'white',
    borderRadius: '20px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  addSeasonBtn: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: '1px dashed #555',
    color: '#777',
    borderRadius: '20px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  deleteSeasonBadge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    backgroundColor: '#ef4444',
    color: 'white',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid #fff',
    zIndex: 5,
  },
};

export default SeasonList;
