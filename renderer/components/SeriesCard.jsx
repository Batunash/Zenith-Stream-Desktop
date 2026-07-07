import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
const normalizeImagePath = (rawPath) => {
  if (!rawPath) return null;
  let p = rawPath.replace(/\\/g, '/');
  const userData = window.api?.paths?.userData?.replace(/\\/g, '/');
  if (userData && p.startsWith(userData)) {
    p = p.replace(userData + '/', '');
  }

  return p;
};

const SeriesCard = ({ data, onClick, onDelete }) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const getPosterSrc = () => {
    if (imgError) return 'https://via.placeholder.com/300x450?text=No+Image';
    if (data.image && data.image.startsWith('http')) return data.image;
    if (data.fullPosterPath) {
      const normalized = normalizeImagePath(data.fullPosterPath);
      return `media://${normalized}`;
    }

    return 'https://via.placeholder.com/300x450?text=No+Img';
  };

  const imageSource = getPosterSrc();

  return (
    <div
      style={styles.card(isHovered)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick && onClick(data.id)}
    >
      <img
        src={imageSource}
        alt={data.title}
        style={styles.image}
        onError={() => setImgError(true)}
      />

      {isHovered && onDelete && (
        <button
          style={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(data);
          }}
          title={t('dashboard.delete_tooltip')}
        >
          🗑️
        </button>
      )}

      <div style={styles.overlay(isHovered)}>
        <span style={styles.title}>{data.title}</span>
        {isHovered && <span style={styles.rating}>{data.rating || '0.0'}</span>}
      </div>
    </div>
  );
};

const styles = {
  card: (isHovered) => ({
    position: 'relative',
    width: '100%',
    aspectRatio: '2/3',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isHovered ? '0 10px 20px rgba(0,0,0,0.5)' : '0 4px 6px rgba(0,0,0,0.3)',
  }),
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  overlay: (isHovered) => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 60%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '15px',
    opacity: isHovered ? 1 : 0.8,
    transition: 'opacity 0.3s',
  }),
  title: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  rating: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#e50914',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  deleteBtn: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    border: '1px solid #ef4444',
    borderRadius: '50%',
    width: '35px',
    height: '35px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    zIndex: 10,
    transition: '0.2s',
  },
};

export default SeriesCard;
