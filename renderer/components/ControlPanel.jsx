import React from 'react';

const ControlPanel = ({ isServerRunning, toggleServer, onOpenSettings ,onAddSerie}) => {
  const styles = getStyles(isServerRunning);

  return (
    <div style={styles.container}>
      <div style={styles.statusSection}>
        <h3 style={{marginBottom: '20px', color: '#eee'}}>Sunucu Durumu</h3>
        
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px'}}>
          <span style={styles.statusIndicator}></span>
          <span style={{fontWeight: '500', color: isServerRunning ? '#4ade80' : '#ef4444'}}>
            {isServerRunning ? 'ÇALIŞIYOR' : 'DURDURULDU'}
          </span>
        </div>
        
        <button 
          style={styles.serverBtn} 
          onClick={toggleServer}
          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          {isServerRunning ? 'Sunucuyu Durdur' : 'Sunucuyu Başlat'}
        </button>
      </div>
      <div>
        <button 
          style={styles.settingsBtn} 
          onClick={onAddSerie}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#333'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px'}}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Dizi ekle
        </button>
        <button 
          style={styles.settingsBtn} 
          onClick={onOpenSettings}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#333'}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Ayarlar
        </button>
      </div>
    </div>
  );
};
const getStyles = (isServerRunning) => ({
  container: {
    width: '300px',
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderLeft: '1px solid #333',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    flexShrink: 0,
    overflow: 'hidden',
  },
  statusSection: {
    textAlign: 'center',
    marginTop: '40px',
  },
  statusIndicator: {
    width: '15px',
    height: '15px',
    borderRadius: '50%',
    backgroundColor: isServerRunning ? '#4ade80' : '#ef4444', // Parametreden gelen değer
    display: 'inline-block',
    marginRight: '10px',
    boxShadow: isServerRunning ? '0 0 10px #4ade80' : 'none',
    transition: 'all 0.3s',
  },
  serverBtn: {
    width: '100%',
    padding: '15px',
    marginTop: '20px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: isServerRunning ? '#ef4444' : '#2563eb', // Parametreden gelen değer
    color: 'white',
    fontSize: '1rem',
    transition: 'background-color 0.2s',
  },
  settingsBtn: {
    width: '100%',
    padding: '12px',
    marginTop:'20px',
    backgroundColor: '#333',
    color: '#bbb',
    border: '1px solid #444',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    transition: 'background-color 0.2s',
  }
});
export default ControlPanel;