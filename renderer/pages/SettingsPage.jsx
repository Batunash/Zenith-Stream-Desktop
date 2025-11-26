import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const SettingsPage = ({ isSetupRequired, onConfigUpdate }) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    PORT: '3000',
    MEDIA_DIR: '',
    JWT_SECRET: '',
    TMDB_API_KEY: '' 
  });
  
  const [loading, setLoading] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({ ip: 'Loading...', port: '3000' });

  useEffect(() => {
    const loadData = async () => {
        try {
            const settings = await window.api.invoke('settings:get');
            const realApiKey = settings.TMDB_API_KEY || settings.VITE_TMDB_API_KEY || '';            
            setConfig(prev => ({ 
                ...prev, 
                ...settings,
                TMDB_API_KEY: realApiKey 
            }));
            console.log("IP Adresi isteniyor..."); 
            const netInfo = await window.api.invoke('server:getNetworkInfo');
            console.log("Gelen IP:", netInfo);

            setNetworkInfo({ 
                ip: netInfo && netInfo.ip ? netInfo.ip : '127.0.0.1',
                port: settings.PORT || '3000' 
            });

        } catch (err) {
            console.error("Ayar yükleme hatası:", err);
            setNetworkInfo({ ip: '127.0.0.1', port: '3000' });
        }
    };
    loadData();
  }, []);

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectDir = async () => {
    const path = await window.api.invoke('dialog:openDirectory');
    if (path) handleChange('MEDIA_DIR', path);
  };

  const handleSave = async () => {
    if (!config.MEDIA_DIR) {
        alert("Lütfen Medya Klasörünü seçin!");
        return;
    }
    setLoading(true);
    const res = await window.api.invoke('settings:save', config);
    
    if (res.success) {
        if (onConfigUpdate) onConfigUpdate(config);
        if (isSetupRequired) {
            alert("Kurulum tamamlandı! Uygulama yeniden başlatılıyor...");
            await window.api.invoke('app:restart');
        } else {
            if (confirm("Ayarlar kaydedildi. Uygulama yeniden başlatılsın mı?")) {
                await window.api.invoke('app:restart');
            }
        }
    } else {
        alert("Hata: " + res.error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if(confirm("Çıkış yapmak istediğine emin misin?")) {
        localStorage.removeItem('user');
        window.location.reload(); 
    }
  };

  const handleSync = async () => {
      alert("Otomatik senkronizasyon başlatıldı."); 
      await window.api.invoke('file:syncDatabase');
  };

  const qrData = JSON.stringify({
      name: "Video Hub Server",
      url: `http://${networkInfo.ip}:${networkInfo.port}`,
  });

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
            {!isSetupRequired && (
                <button onClick={() => navigate('/')} style={styles.backBtn}>&larr; Geri</button>
            )}
            <h1 style={{margin:0}}>Ayarlar</h1>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Sunucu & Medya</h3>
            
            <div style={styles.inputGroup}>
                <label style={styles.label}>Sunucu Portu</label>
                <input 
                    style={styles.input} 
                    value={config.PORT} 
                    onChange={(e) => handleChange('PORT', e.target.value)}
                />
            </div>

            <div style={styles.inputGroup}>
                <label style={styles.label}>Medya Klasörü</label>
                <div style={{display:'flex', gap:'10px'}}>
                    <input 
                        style={{...styles.input, flex:1, color: '#aaa'}} 
                        value={config.MEDIA_DIR} 
                        readOnly 
                    />
                    <button style={styles.browseBtn} onClick={handleSelectDir}>Seç</button>
                </div>
            </div>
            <div style={styles.inputGroup}>
                <label style={styles.label}>TMDB API Anahtarı (Opsiyonel)</label>
                <input 
                    style={styles.input} 
                    value={config.TMDB_API_KEY || ''} 
                    onChange={(e) => handleChange('TMDB_API_KEY', e.target.value)}
                    placeholder="API Key giriniz..."
                />
                <span style={styles.hint}>
                    Otomatik kapak ve bilgi çekmek için gereklidir.
                </span>
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Güvenlik</h3>
            <div style={styles.inputGroup}>
                <label style={styles.label}>JWT Secret</label>
                <input 
                    type="password"
                    style={styles.input} 
                    value={config.JWT_SECRET} 
                    onChange={(e) => handleChange('JWT_SECRET', e.target.value)}
                />
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📱 Mobil Bağlantı</h3>
            <div style={{display: 'flex', gap: '30px', alignItems: 'center'}}>
                <div style={{background: 'white', padding: '10px', borderRadius: '8px'}}>
                    <QRCodeSVG value={qrData} size={150} />
                </div>
                <div>
                    <p style={{marginBottom: '10px', color: '#ccc'}}>
                        Mobil uygulamadan bu kodu taratın.
                    </p>
                    <div style={styles.connectionBox}>
                        <span style={{color: '#888'}}>Adres:</span>
                        <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80', marginTop: '5px'}}>
                            http://{networkInfo.ip}:{networkInfo.port}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>İşlemler</h3>
            <div style={{display:'flex', gap:'15px'}}>
                <button style={styles.actionBtn} onClick={handleSync}>🔄 DB Senkronize Et</button>
                <button style={{...styles.actionBtn, backgroundColor: '#ef4444', border:'none', color:'white'}} onClick={handleLogout}>🚪 Çıkış Yap</button>
            </div>
        </div>

        <div style={styles.footer}>
            <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
                {loading ? 'Yeniden Başlatılıyor...' : 'Kaydet ve Yeniden Başlat'}
            </button>
        </div>

      </div>
    </div>
  );
};

const styles = {
  page: { padding: '40px', height: '100%', overflowY: 'auto', backgroundColor: '#121212', color: 'white' },
  container: { maxWidth: '800px', margin: '0 auto' },
  header: { display:'flex', alignItems:'center', gap:'20px', marginBottom:'40px', borderBottom:'1px solid #333', paddingBottom:'20px' },
  backBtn: { background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:'1.2rem' },
  section: { marginBottom: '40px', backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #333' },
  sectionTitle: { marginTop: 0, marginBottom: '20px', color: '#2563eb' },
  inputGroup: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.9rem' },
  input: { width: '100%', padding: '12px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '6px', color: 'white', fontSize: '1rem', outline:'none' },
  hint: { display: 'block', marginTop: '5px', color: '#666', fontSize: '0.8rem' },
  browseBtn: { padding: '0 20px', backgroundColor: '#333', border: '1px solid #555', color: 'white', borderRadius: '6px', cursor: 'pointer' },
  actionBtn: { padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid #555', color: '#ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  footer: { display: 'flex', justifyContent: 'flex-end', marginTop: '20px', marginBottom: '50px' },
  saveBtn: { padding: '15px 40px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
  connectionBox: {backgroundColor: '#222',padding: '15px',borderRadius: '8px',border: '1px dashed #444',marginTop: '10px'  },  
};

export default SettingsPage;