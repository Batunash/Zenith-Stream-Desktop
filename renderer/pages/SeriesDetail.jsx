import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const SeriesDetail = () => {
  const { folderName } = useParams(); 
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState({});
  const fetchDetails = async () => {
    try {
      const data = await window.api.invoke('file:getSeriesDetail', folderName);
      if (data.error) {
        alert("Dizi bulunamadı!");
        navigate('/');
        return;
      }
      setMetadata(data);
      setSeasons(data.seasons || []);
      if (data.seasons && data.seasons.length > 0) {
        setActiveSeason(data.seasons[0]);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Detay hatası:", error);
    }
  };
  useEffect(() => {
    if (activeSeason) {
      const fetchEpisodes = async () => {
        const eps = await window.api.invoke('file:getEpisodes', { 
            folderName, 
            season: activeSeason 
        });
        setEpisodes(eps);
        setLoading(false);
      };
      fetchEpisodes();
    }
  }, [activeSeason, folderName]);
  useEffect(() => {
    fetchDetails();
  }, [folderName]);
  useEffect(() => {
    window.api.receive("file:addEpisode:progress", (data) => {
      setTransfers((prev) => ({
        ...prev,
        [data.file]: { percent: data.percent, status: 'transferring' },
      }));
    });
    window.api.receive("file:addEpisode:done", (data) => {
      setTransfers((prev) => ({
        ...prev,
        [data.file]: { 
            percent: 100, 
            status: data.error ? 'error' : 'completed',
            error: data.error 
        },
      }));
      if (!data.error) fetchEpisodes();
    });

    return () => {
        window.api.remove("file:addEpisode:progress");
        window.api.remove("file:addEpisode:done");
    };
  }, [activeSeason]);
  const handleUploadEpisode = async () => {
    if (!activeSeason) {
        alert("Lütfen önce bir sezon oluşturun veya seçin.");
        return;
    }
    const files = await window.api.invoke("dialog:openVideoFiles");

    if (!files || !files.length) return;
    const initialTransfers = {};
    files.forEach(path => {
      initialTransfers[path] = { percent: 0, status: 'pending' };
    });
    setTransfers(prev => ({ ...prev, ...initialTransfers }));
    const videos = files.map(path => ({ path }));
    await window.api.invoke("file:addEpisode", {
      serieName: folderName, 
      seasonId: activeSeason,
      videos
    });
  };
  const handleAddSeason = async () => {
    const nextSeasonNum = seasons.length + 1;
    const newSeasonName = `Season ${nextSeasonNum}`;
    
    const res = await window.api.invoke('file:createSeason', {
        serieName: folderName,
        seasonId: newSeasonName
    });

    if (res.isExist) {
        setSeasons([...seasons, newSeasonName]);
        setActiveSeason(newSeasonName);
    } else {
        alert("Sezon oluşturulamadı: " + res.message);
    }
  };
  if (loading && !metadata) return <div style={{color:'white', padding: 40}}>Yükleniyor...</div>;
  const backdropUrl = metadata?.backdrop 
    ? (metadata.backdrop.startsWith('http') ? metadata.backdrop : `media://${metadata.fullPosterPath}`) 
    : `media://${metadata?.fullPosterPath}`;

  return (
    <div style={styles.page}>
      <div style={styles.bannerContainer}>
        <div style={{...styles.bannerImage, backgroundImage: `url('${backdropUrl}')`}}></div>
        <div style={styles.bannerOverlay}></div>
        <div style={styles.headerContent}>
            <button onClick={() => navigate('/')} style={styles.backBtn}>&larr; Geri</button>
            <h1 style={styles.title}>{metadata?.title}</h1>
            <div style={styles.metaBadges}>
                <span style={styles.badge}>IMDB: {metadata?.rating}</span>
                <span style={styles.badge}>{seasons.length} Sezon</span>
            </div>
            <p style={styles.overview}>{metadata?.overview}</p>
        </div>
      </div>
      <div style={styles.contentBody}>
        <div style={styles.seasonSection}>
            <div style={styles.seasonList}>
                {seasons.map(season => (
                    <button key={season} style={activeSeason === season ? styles.activeSeasonBtn : styles.seasonBtn} onClick={() => setActiveSeason(season)}>
                        {season}
                    </button>
                ))}
                <button style={styles.addSeasonBtn} onClick={handleAddSeason}>+ Yeni Sezon</button>
            </div>
        </div>
        <div style={styles.episodeSection}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
                <h3 style={{color: 'white', margin:0}}>{activeSeason} Bölümleri</h3>
                <button style={styles.uploadBtn} onClick={handleUploadEpisode}>☁️ Bölüm Yükle</button>
            </div>
            {Object.keys(transfers).length > 0 && (
                <div style={styles.transferContainer}>
                    {Object.entries(transfers).map(([path, item]) => {
                         const fileName = path.split(/[/\\]/).pop(); 
                         return (
                            <div key={path} style={styles.transferItem}>
                                <div style={styles.transferInfo}>
                                    <span style={styles.fileName} title={fileName}>{fileName}</span>
                                    <span style={styles.percentText}>
                                        {item.status === 'error' ? 'HATA' : item.status === 'completed' ? 'TAMAMLANDI' : `%${item.percent.toFixed(0)}`}
                                    </span>
                                </div>
                                <div style={styles.progressBarBg}>
                                    <div style={{
                                        ...styles.progressBarFill,
                                        width: `${item.percent}%`,
                                        backgroundColor: item.status === 'error' ? '#ef4444' : item.status === 'completed' ? '#22c55e' : '#3b82f6'
                                    }} />
                                </div>
                                {item.error && <div style={{color: '#ef4444', fontSize:'0.75rem', marginTop:2}}>{item.error}</div>}
                            </div>
                         );
                    })}
                </div>
            )}
            {episodes.length > 0 ? (
                <div style={styles.episodeGrid}>
                    {episodes.map((ep, index) => (
                        <div key={index} style={styles.episodeCard}>
                            <div style={styles.epIcon}>▶</div>
                            <div style={{overflow:'hidden'}}>
                                <div style={styles.epName}>{ep.name}</div>
                                <div style={styles.epSize}>{(ep.size / (1024*1024)).toFixed(1)} MB</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={styles.emptyState}>Bu sezonda henüz bölüm yok.</div>
            )}
        </div>
      </div>
    </div>
  );
};
const styles = {
  page: { height: '100%', overflowY: 'auto', backgroundColor: '#121212', color: 'white' },
  bannerContainer: { position: 'relative', height: '40vh', width: '100%' },
  bannerImage: { width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.6 },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(18,18,18,0) 0%, rgba(18,18,18,1) 100%)' },
  headerContent: { position: 'absolute', bottom: '20px', left: '40px', right: '40px', zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem', marginBottom: 10 },
  title: { fontSize: '3rem', margin: '0 0 10px 0', textShadow: '0 2px 10px rgba(0,0,0,0.8)' },
  metaBadges: { display: 'flex', gap: '10px', marginBottom: '15px' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.9rem', backdropFilter: 'blur(5px)' },
  overview: { maxWidth: '800px', lineHeight: '1.6', color: '#ddd', fontSize: '1rem', textShadow: '0 1px 5px rgba(0,0,0,0.8)' },
  contentBody: { padding: '0 40px 50px 40px' },
  seasonSection: { marginBottom: '40px' },
  seasonList: { display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'thin' },
  seasonBtn: { padding: '10px 20px', backgroundColor: '#222', border: '1px solid #333', color: '#aaa', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '1rem', transition: '0.2s' },
  activeSeasonBtn: { padding: '10px 20px', backgroundColor: '#e50914', border: '1px solid #e50914', color: 'white', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '1rem', fontWeight: 'bold' },
  addSeasonBtn: { padding: '10px 20px', backgroundColor: 'transparent', border: '1px dashed #555', color: '#777', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap' },
  episodeSection: { animation: 'fadeIn 0.5s' },
  uploadBtn: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' },
  episodeGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  episodeCard: { display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer', transition: 'background 0.2s' },
  epIcon: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' },
  epName: { fontWeight: '500', fontSize: '1rem', marginBottom: '4px' },
  epSize: { fontSize: '0.8rem', color: '#666' },
  emptyState: { padding: '40px', textAlign: 'center', color: '#555', border: '2px dashed #333', borderRadius: '12px' },
  transferContainer: { marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  transferItem: { backgroundColor: '#222', padding: '10px', borderRadius: '8px', border: '1px solid #333' },
  transferInfo: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' },
  fileName: { maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  percentText: { fontWeight: 'bold', color: '#aaa', fontSize: '0.8rem' },
  progressBarBg: { width: '100%', height: '6px', backgroundColor: '#444', borderRadius: '3px', overflow: 'hidden' },
  progressBarFill: { height: '100%', transition: 'width 0.3s ease, background-color 0.3s' }
};

export default SeriesDetail;