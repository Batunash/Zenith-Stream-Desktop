import React, { useState,useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FormInput from '../components/FormInput';
import { fetchSeriesByImdb } from '../services/tmdbService'; 
import { extractImdbId } from '../utils/formatters';

const AddSeriesPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('auto'); 
  const [imdbLink, setImdbLink] = useState('');
  const [fetchedData, setFetchedData] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [manualForm, setManualForm] = useState({
    title: '',
    image: '',
    rating: '',
    overview: ''
  });
  useEffect(() => {
    window.api.invoke('settings:get').then(cfg => {
      const apiKey = cfg.TMDB_API_KEY || cfg.VITE_TMDB_API_KEY;
      const hasKey = apiKey && apiKey.length > 10;
        setHasApiKey(hasKey);
        if (!hasKey) setActiveTab('manual');
        setHasApiKey(hasKey);
        if (!hasKey) setActiveTab('manual');
    });
  }, []);
  const handleFetch = async () => {
    const imdbId = extractImdbId(imdbLink);
    if (!imdbId) { setError("Geçerli link bulunamadı"); return; }
    
    setLoading(true); setError(null);
    try {
      const data = await fetchSeriesByImdb(imdbId);
      if (data) setFetchedData(data);
      else setError("Veri bulunamadı");
    } catch (e) { setError("Bağlantı hatası"); } 
    finally { setLoading(false); }
  };
  const saveAuto = async () => {
    if (!fetchedData) return;
    const finalMetadata = {
        ...fetchedData,
        id: Date.now(),
    };
    try {
        const res = await window.api.invoke("file:createSerie", {
            serieName: finalMetadata.title,
            metadata: finalMetadata         
        });
        if (res.success) {
            alert(`"${finalMetadata.title}" kütüphaneye eklendi!\n${finalMetadata.numberOfSeasons} sezon klasörü oluşturuldu.`);
            navigate('/');
        } else {
            alert("Hata: " + res.message);
        }
    } catch (error) {
        console.error("Auto Save Hatası:", error);
        alert("Kaydetme sırasında bir hata oluştu.");
    }
  };
  const handleManualChange = (field, value) => {
    setManualForm(prev => ({ ...prev, [field]: value }));
  };

  const saveManual = async () => {
    if (!manualForm.title || !manualForm.image) {
      alert("İsim ve Resim zorunludur!");
      return;
    }
    const metadata = {
      id: Date.now(),
      title: manualForm.title,
      image: manualForm.image,
      rating: manualForm.rating || "0.0",
      overview: manualForm.overview || "Açıklama yok.",
      imdb_id: null,
      numberOfSeasons: 1
    };

    try {
      const res = await window.api.invoke("file:createSerie", {
        serieName: manualForm.title,
        metadata: metadata
      });

      if (res.success) {
         alert("Dizi başarıyla oluşturuldu!");
         navigate('/'); 
      } else {
         alert("Hata: " + res.message);
      }
    } catch (error) {
      console.error("IPC Hatası:", error);
    }
  };
  const handleAddImage =async()=>{
        const filePath = await window.api.invoke('dialog:openFileImage');
        if (filePath) {
          handleManualChange('image', filePath);
        }
      
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.tabHeader}>
          <button 
            disabled={!hasApiKey}
            style={activeTab === 'auto' ? styles.activeTab : styles.tab} 
            onClick={() => { if(hasApiKey) { setActiveTab('auto'); setError(null); }}}
            title={!hasApiKey ? "Ayarlardan API Key giriniz" : ""}
          >
            🔗 Link ile Getir
          </button>
          <button 
            style={activeTab === 'manual' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveTab('manual')}
          >
            ✏️ Elle Gir
          </button>
        </div>
        <div style={styles.contentArea}>
          {activeTab === 'auto' && (
            <div style={{animation: 'fadeIn 0.3s'}}>
              <h3 style={styles.subTitle}>IMDB veya TMDB Linki Yapıştır</h3>
              
              <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                <input 
                  style={styles.input} 
                  placeholder="örn: https://www.imdb.com/title/tt0903747/" 
                  value={imdbLink}
                  onChange={(e) => setImdbLink(e.target.value)}
                />
                <button 
                  style={styles.actionBtn} 
                  onClick={handleFetch}
                  disabled={loading || !imdbLink}
                >
                  {loading ? '...' : 'Bul'}
                </button>
              </div>

              {error && <div style={styles.error}>{error}</div>}
              {fetchedData && (
                <div style={styles.previewCard}>
                  <img src={fetchedData.image} style={styles.previewPoster} alt="" />
                  <div style={{flex: 1}}>
                    <h2 style={{color: 'white', margin: 0}}>{fetchedData.title}</h2>
                    <div style={styles.badge}>IMDB: {fetchedData.rating}</div>
                    <p style={{color: '#ccc', fontSize: '0.9rem'}}>{fetchedData.overview}</p>
                    
                    <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
                      <button style={styles.cancelBtn} onClick={() => setFetchedData(null)}>Vazgeç</button>
                      <button style={styles.saveBtn} onClick={saveAuto}>Bu Diziyi Ekle</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'manual' && (
            <div style={{animation: 'fadeIn 0.3s'}}>
              <h3 style={styles.subTitle}>Dizi Bilgilerini Giriniz</h3>
              
              <FormInput 
                label="Dizi Adı *" 
                value={manualForm.title} 
                onChange={(e) => handleManualChange('title', e.target.value)}
              />
             
             
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem' }}>
                  Kapak Resmi *
                </label>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button 
                    onClick={handleAddImage}
                    style={styles.fileBtn}
                  >
                    📁 Dosya Seç
                  </button>
                  <span style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {manualForm.image || "Dosya seçilmedi"}
                  </span>
                </div>
              </div>
              <div style={styles.imageWrapper}>
                {(activeTab === 'auto' ? fetchedData?.image : manualForm.image) ? (
                  <img 
                    src={
                      (activeTab === 'auto' ? fetchedData?.image : manualForm.image).startsWith('http')
                        ? (activeTab === 'auto' ? fetchedData?.image : manualForm.image)
                        : `file://${manualForm.image}`
                    } 
                    alt="Önizleme" 
                    style={styles.previewImage} 
                    onError={(e) => e.target.style.display='none'} 
                  />
                ) : (
                  <div style={styles.placeholderImage}>Görsel Bekleniyor</div>
                )}
              </div>
              <FormInput 
                label="Özet (Opsiyonel)" 
                value={manualForm.overview} 
                onChange={(e) => handleManualChange('overview', e.target.value)}
                isTextArea={true}
              />

              <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                 <button style={styles.saveBtn} onClick={saveManual}>Kaydet</button>
              </div>
            </div>
          )}

        </div>
        <button onClick={() => navigate('/')} style={styles.backBtn}>&larr; İptal ve Geri Dön</button>
      </div>
    </div>
  );
};

const styles = {
  page: { padding: '40px', height: '100%', overflowY: 'auto', color: 'white' },
  container: { maxWidth: '700px', margin: '0 auto' },
  tabHeader: { display: 'flex', borderBottom: '2px solid #333', marginBottom: '30px' },
  tab: { flex: 1, padding: '15px', background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' },
  activeTab: { flex: 1, padding: '15px', background: 'transparent', borderBottom: '2px solid #e50914', color: 'white', cursor: 'default', fontSize: '1rem', fontWeight: 'bold' },
  contentArea: { minHeight: '300px' },
  subTitle: { marginBottom: '20px', color: '#ddd' },
  input: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: 'white', outline: 'none' },
  actionBtn: { padding: '0 25px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  error: { color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px', marginBottom: '20px' },
  previewCard: { display: 'flex', gap: '20px', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333' },
  previewPoster: { width: '120px', borderRadius: '8px', objectFit: 'cover' },
  badge: { display: 'inline-block', background: '#e50914', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', margin: '10px 0' },
  saveBtn: { padding: '12px 30px', backgroundColor: '#4ade80', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid #555', color: '#ccc', borderRadius: '8px', cursor: 'pointer' },
  backBtn: { background: 'none', border: 'none', color: '#666', marginTop: '30px', cursor: 'pointer' },
  fileBtn: {padding: '10px 15px',backgroundColor: '#333',border: '1px solid #555',color: 'white',borderRadius: '8px',cursor: 'pointer',fontWeight: 'bold',fontSize: '0.9rem',whiteSpace: 'nowrap'}
  };

export default AddSeriesPage;