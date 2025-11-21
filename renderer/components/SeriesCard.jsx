import React, { useState } from 'react';

const SeriesCard = ({ data, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const styles = getStyles(isHovered);
  let imageSource;
  if (data.fullPosterPath) {
      imageSource = `media://${data.fullPosterPath}`;
  } else if (data.image) {
      imageSource = data.image;
  } else {
      imageSource = 'https://via.placeholder.com/300x450?text=No+Img';
  }
  return (
    <div 
      style={styles.card} 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick && onClick(data.id)}
    >
      <img src={imageSource} alt={data.title} style={styles.image} />
      
      <div style={styles.overlay}>
        <span style={styles.title}>{data.title}</span>
        {isHovered && <span style={styles.rating}>{data.rating || '0.0'}</span>}
      </div>
    </div>
  );
};
const getStyles = (isHovered) => ({
  card: {
    position: 'relative',
    width: '100%',
    aspectRatio: '2/3',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isHovered ? '0 10px 20px rgba(0,0,0,0.5)' : '0 4px 6px rgba(0,0,0,0.3)',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlay: {
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
  },
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
  }
});
export default SeriesCard;