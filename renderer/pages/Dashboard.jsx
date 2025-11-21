import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import SeriesCard from '../components/SeriesCard';
import ControlPanel from '../components/ControlPanel';

export default function Dashboard() {
  const navigate = useNavigate(); 
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [series, setSeries] = useState([]); 
  const loadSeries = async () => {
    try {
      const data = await window.api.invoke('file:getSeries');
      setSeries(data);
    } catch (error) {
      console.error("Diziler yüklenemedi:", error);
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

  
  const handleAddSerie = () => {
      navigate('/add-series');
  };


  const navigateToSettings = () => {
      navigate('/settings');
  };

  return (
    <div style={styles.page}>
      <div style={styles.mainContent}>
        <h1 style={styles.header}>Kütüphanem</h1>
        {series.length > 0 ? (
            <div style={styles.grid}>
            {series.map((serie) => (
                <SeriesCard 
                key={serie.id} 
                data={serie}
                />
            ))}
            </div>
        ) : (
            <div style={{color: '#666', textAlign: 'center', marginTop: '50px'}}>
                <h2>Henüz hiç dizi yok.</h2>
                <p>Sağ alttaki menüden ilk dizini ekle!</p>
            </div>
        )}
      </div>

      <ControlPanel 
        isServerRunning={isServerRunning}
        toggleServer={handleServerToggle}
        onAddSerie={handleAddSerie} 
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