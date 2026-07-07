import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import SeriesCard from '../components/SeriesCard';
import ControlPanel from '../components/ControlPanel';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate(); 
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [series, setSeries] = useState([]); 

  const loadSeries = async () => {
    try {
      const seriesList = await window.api.invoke('file:getSeries');
      console.log('DASHBOARD SERIES LIST:', seriesList);
      setSeries(seriesList || []);
    } catch (err) {
      console.error('Error loading series:', err);
    }
  };

  const refreshStatus = async () => {
    try {
      const res = await window.api.invoke("server:status");
      setIsServerRunning(res.running);
    } catch (error) {
      console.error("IPC Hatası (Status):", error);
    }
  };

  useEffect(() => {
    loadSeries();   
    refreshStatus();
  }, []);

  const handleServerToggle = async () => {
    try {
      if (isServerRunning) {
        await window.api.invoke("server:stop");
      } else {
        await window.api.invoke("server:start");
      }
      await refreshStatus();
    } catch (error) {
      console.error("IPC Hatası (Start/Stop):", error);
    }
  };



  const navigateToSettings = () => {
      navigate('/settings');
  };

  const handleDeleteSerie = async (serie) => {
    if (!confirm(t('dashboard.delete_confirm', { title: serie.title }))) return;
    try {
        const res = await window.api.invoke('file:deleteSerie', serie.folderName);
        if (res.success) {
            setSeries(prev => prev.filter(s => s.folderName !== serie.folderName));
        } else {
            alert(t('common.error') + ": " + res.error);
        }
    } catch (err) {
        console.error(err);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.mainContent}>
        <h1 style={styles.header}>{t('dashboard.title')}</h1>
        {series.length > 0 ? (
            <div style={styles.grid}>
            {series.map((serie) => (
                <SeriesCard 
                key={serie.id} 
                data={serie}
                onClick={() => navigate(`/details/${encodeURIComponent(serie.folderName)}`)}
                onDelete={handleDeleteSerie}
                />
            ))}
            </div>
        ) : (
            <div style={{color: '#666', textAlign: 'center', marginTop: '50px'}}>
                <h2>{t('dashboard.no_series_title')}</h2>
                <p>{t('dashboard.no_series_desc')}</p>
            </div>
        )}
      </div>

      <ControlPanel
        isServerRunning={isServerRunning}
        toggleServer={handleServerToggle}
        onOpenSettings={navigateToSettings}
      />
    </div>
  );
}

const styles = {
    page: {
      display: 'flex',       
      width: '100%',          
      height: '100%',         
      overflow: 'hidden',     
    },
    mainContent: {
      flex: 1,                
      padding: '40px',
      overflowY: 'auto',      
      height: '100%',         
    },
    header: {
      color: 'white',
      marginBottom: '30px',
      fontSize: '2rem',
      fontWeight: 'bold',
      borderBottom: '1px solid #333',
      paddingBottom: '15px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
      gap: '25px',
      paddingBottom: '50px'
    }
};