import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

const SettingsPage = ({ isSetupRequired, onConfigUpdate }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    PORT: '3000',
    MEDIA_DIR: '',
    JWT_SECRET: '',
    TMDB_API_KEY: '',
    AI_PROVIDER: 'nvidia',
    GEMINI_API_KEY: '',
    NVIDIA_API_KEY: ''
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
            const netInfo = await window.api.invoke('server:getNetworkInfo');
            
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

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleSelectDir = async () => {
    const path = await window.api.invoke('dialog:openDirectory');
    if (path) handleChange('MEDIA_DIR', path);
  };

  const handleSave = async () => {
    if (!config.MEDIA_DIR) {
        alert(t('settings.dir_warning'));
        return;
    }
    setLoading(true);
    const res = await window.api.invoke('settings:save', config);
    
    if (res.success) {
        if (onConfigUpdate) onConfigUpdate(config);
        if (isSetupRequired) {
            alert(t('settings.restarting'));
            await window.api.invoke('app:restart');
        } else {
            if (confirm(t('settings.restart_confirm'))) {
                await window.api.invoke('app:restart');
            }
        }
    } else {
        alert(t('common.error') + ": " + res.error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if(confirm(t('settings.logout_confirm'))) {
        localStorage.removeItem('user');
        window.location.reload(); 
    }
  };

  const handleSync = async () => {
      alert(t('common.processing')); 
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
                <button onClick={() => navigate('/')} style={styles.backBtn}>&larr; {t('common.back')}</button>
            )}
            <h1 style={{margin:0}}>{t('settings.title')}</h1>
            
            <div style={{marginLeft: 'auto', display: 'flex', gap: '10px'}}>
                <button onClick={() => changeLanguage('tr')} style={{...styles.langBtn, opacity: i18n.language === 'tr' ? 1 : 0.5}}>TR</button>
                <button onClick={() => changeLanguage('en')} style={{...styles.langBtn, opacity: i18n.language === 'en' ? 1 : 0.5}}>EN</button>
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('settings.section_server')}</h3>
            
            <div style={styles.inputGroup}>
                <label style={styles.label}>{t('settings.port')}</label>
                <input 
                    style={styles.input} 
                    value={config.PORT} 
                    onChange={(e) => handleChange('PORT', e.target.value)}
                />
            </div>

            <div style={styles.inputGroup}>
                <label style={styles.label}>{t('settings.media_dir')}</label>
                <div style={{display:'flex', gap:'10px'}}>
                    <input 
                        style={{...styles.input, flex:1, color: '#aaa'}} 
                        value={config.MEDIA_DIR} 
                        readOnly 
                    />
                    <button style={styles.browseBtn} onClick={handleSelectDir}>{t('settings.select_btn')}</button>
                </div>
            </div>
            <div style={styles.inputGroup}>
                <label style={styles.label}>{t('settings.api_key')} ({t('common.optional')})</label>
                <input 
                    style={styles.input} 
                    value={config.TMDB_API_KEY || ''} 
                    onChange={(e) => handleChange('TMDB_API_KEY', e.target.value)}
                    placeholder="API Key..."
                />
                <span style={styles.hint}>
                    {t('settings.api_key_help')}
                </span>
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('settings.section_ai')}</h3>
            <div style={styles.inputGroup}>
                <label style={styles.label}>{t('settings.ai_provider')}</label>
                <select
                    style={styles.input}
                    value={config.AI_PROVIDER || 'nvidia'}
                    onChange={(e) => handleChange('AI_PROVIDER', e.target.value)}
                >
                    <option value="nvidia">{t('settings.provider_nvidia')}</option>
                    <option value="gemini">{t('settings.provider_gemini')}</option>
                </select>
            </div>
            {(config.AI_PROVIDER || 'nvidia') === 'nvidia' && (
                <div style={styles.inputGroup}>
                    <label style={styles.label}>{t('settings.nvidia_api_key')} ({t('common.optional')})</label>
                    <input
                        type="password"
                        style={styles.input}
                        value={config.NVIDIA_API_KEY || ''}
                        onChange={(e) => handleChange('NVIDIA_API_KEY', e.target.value)}
                        placeholder="nvapi-..."
                    />
                    <span style={styles.hint}>
                        {t('settings.nvidia_api_key_help')}
                    </span>
                </div>
            )}
            {config.AI_PROVIDER === 'gemini' && (
                <div style={styles.inputGroup}>
                    <label style={styles.label}>{t('settings.gemini_api_key')} ({t('common.optional')})</label>
                    <input
                        type="password"
                        style={styles.input}
                        value={config.GEMINI_API_KEY || ''}
                        onChange={(e) => handleChange('GEMINI_API_KEY', e.target.value)}
                        placeholder="AIza..."
                    />
                    <span style={styles.hint}>
                        {t('settings.gemini_api_key_help')}
                    </span>
                </div>
            )}
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('settings.section_security')}</h3>
            <div style={styles.inputGroup}>
                <label style={styles.label}>{t('settings.jwt_secret')}</label>
                <input 
                    type="password"
                    style={styles.input} 
                    value={config.JWT_SECRET} 
                    onChange={(e) => handleChange('JWT_SECRET', e.target.value)}
                />
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📱 {t('settings.section_mobile')}</h3>
            <div style={{display: 'flex', gap: '30px', alignItems: 'center'}}>
                <div style={{background: 'white', padding: '10px', borderRadius: '8px'}}>
                    <QRCodeSVG value={qrData} size={150} />
                </div>
                <div>
                    <p style={{marginBottom: '10px', color: '#ccc'}}>
                        {t('settings.mobile_scan_hint')}
                    </p>
                    <div style={styles.connectionBox}>
                        <span style={{color: '#888'}}>{t('settings.address')}:</span>
                        <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80', marginTop: '5px'}}>
                            http://{networkInfo.ip}:{networkInfo.port}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('settings.section_actions')}</h3>
            <div style={{display:'flex', gap:'15px'}}>
                <button style={styles.actionBtn} onClick={handleSync}>🔄 {t('settings.sync_db')}</button>
                <button style={{...styles.actionBtn, backgroundColor: '#ef4444', border:'none', color:'white'}} onClick={handleLogout}>🚪 {t('settings.logout')}</button>
            </div>
        </div>

        {/* TMDB Disclaimer */}
        <div style={styles.tmdbContainer}>
            <img 
                src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" 
                alt="TMDB Logo" 
                style={{ height: '15px', marginBottom: '8px' }}
            />
            <p style={{ fontSize: '0.75rem', color: '#555', margin: 0 }}>
                {t('settings.tmdb_disclaimer')}
            </p>
        </div>

        <div style={styles.footer}>
            <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
                {loading ? t('settings.restarting') : t('settings.save_restart')}
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
  langBtn: { padding: '5px 10px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  tmdbContainer: { textAlign: 'center', marginBottom: '20px', opacity: 0.6 },
};

export default SettingsPage;