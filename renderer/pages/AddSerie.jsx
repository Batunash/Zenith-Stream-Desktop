import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FormInput from '../components/FormInput';
import { fetchSeriesByImdb } from '../services/tmdbService';
import { extractImdbId } from '../utils/formatters';
import { useTranslation } from 'react-i18next';

const AddSeriesPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [contentType, setContentType] = useState('serie');
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
    overview: '',
  });
  useEffect(() => {
    window.api.invoke('settings:get').then((cfg) => {
      const apiKey = cfg.TMDB_API_KEY || cfg.VITE_TMDB_API_KEY;
      const hasKey = apiKey && apiKey.length > 10;
      setHasApiKey(hasKey);
      if (!hasKey) setActiveTab('manual');
    });
  }, []);

  const handleFetch = async () => {
    const imdbId = extractImdbId(imdbLink);
    if (!imdbId) {
      setError(t('add_series.error_link'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchSeriesByImdb(imdbId);
      if (data) {
        setFetchedData(data);
        setContentType(data.type === 'movie' ? 'movie' : 'serie');
      } else setError(t('add_series.error_not_found'));
    } catch (e) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const saveAuto = async () => {
    if (!fetchedData) return;

    const finalMetadata = {
      ...fetchedData,
      id: Date.now(),
      type: contentType,
      numberOfSeasons: contentType === 'movie' ? 1 : fetchedData?.numberOfSeasons || 0,
    };
    try {
      const res = await window.api.invoke('file:createSerie', {
        serieName: finalMetadata.title,
        metadata: finalMetadata,
      });

      if (res.success) {
        const typeText =
          contentType === 'movie' ? t('add_series.type_movie') : t('add_series.type_serie');
        alert(t('add_series.success_added', { type: typeText }));
        navigate('/');
      } else {
        alert(t('common.error') + ': ' + res.message);
      }
    } catch (error) {
      console.error('Auto Save Hatası:', error);
      alert(t('common.error'));
    }
  };

  const handleManualChange = (field, value) => {
    setManualForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveManual = async () => {
    if (!manualForm.title || !manualForm.image) {
      alert(t('add_series.error_missing_fields'));
      return;
    }
    const metadata = {
      id: Date.now(),
      title: manualForm.title,
      image: manualForm.image,
      rating: manualForm.rating || '0.0',
      overview: manualForm.overview || 'Açıklama yok.',
      imdb_id: null,
      numberOfSeasons: contentType === 'movie' ? 1 : 0,
      type: contentType,
    };

    try {
      const res = await window.api.invoke('file:createSerie', {
        serieName: manualForm.title,
        metadata: metadata,
      });

      if (res.success) {
        const typeText =
          contentType === 'movie' ? t('add_series.type_movie') : t('add_series.type_serie');
        alert(t('add_series.success_added', { type: typeText }));
        navigate('/');
      } else {
        alert(t('common.error') + ': ' + res.message);
      }
    } catch (error) {
      console.error('IPC Hatası:', error);
    }
  };

  const handleAddImage = async () => {
    const result = await window.api.invoke('dialog:openFileImage');

    if (result) {
      setManualForm((prev) => ({ ...prev, image: result }));
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.tabHeader}>
          <button
            disabled={!hasApiKey}
            style={activeTab === 'auto' ? styles.activeTab : styles.tab}
            onClick={() => {
              if (hasApiKey) {
                setActiveTab('auto');
                setError(null);
              }
            }}
            title={!hasApiKey ? t('add_series.api_key_hint') : ''}
          >
            🔗 {t('add_series.tab_link')}
          </button>
          <button
            style={activeTab === 'manual' ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab('manual')}
          >
            ✏️ {t('add_series.tab_manual')}
          </button>
        </div>

        <div style={styles.contentArea}>
          {activeTab === 'auto' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={styles.subTitle}>IMDB / TMDB Link</h3>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  style={styles.input}
                  placeholder={t('add_series.link_placeholder')}
                  value={imdbLink}
                  onChange={(e) => setImdbLink(e.target.value)}
                />
                <button
                  style={styles.actionBtn}
                  onClick={handleFetch}
                  disabled={loading || !imdbLink}
                >
                  {loading ? '...' : t('add_series.fetch_btn')}
                </button>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              {fetchedData && (
                <div style={styles.previewCard}>
                  <img src={fetchedData.image} style={styles.previewPoster} alt="" />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ color: 'white', margin: 0 }}>{fetchedData.title}</h2>
                    <div style={styles.badge}>IMDB: {fetchedData.rating}</div>
                    <p style={{ color: '#ccc', fontSize: '0.9rem' }}>{fetchedData.overview}</p>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <button style={styles.cancelBtn} onClick={() => setFetchedData(null)}>
                        {t('common.cancel')}
                      </button>
                      <button style={styles.saveBtn} onClick={saveAuto}>
                        {t('add_series.add_this_serie')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h3 style={styles.subTitle}>{t('add_series.manual_title')}</h3>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    color: '#fff',
                    marginBottom: '10px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                  }}
                >
                  {t('add_series.content_type')}
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    backgroundColor: '#222',
                    color: 'white',
                    fontSize: '1rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="serie">{t('add_series.type_serie')}</option>
                  <option value="movie">{t('add_series.type_movie')}</option>
                </select>
              </div>

              <FormInput
                label={t('add_series.name_label') + ' *'}
                value={manualForm.title}
                onChange={(e) => handleManualChange('title', e.target.value)}
              />

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    color: '#ccc',
                    marginBottom: '8px',
                    fontSize: '0.9rem',
                  }}
                >
                  {t('add_series.image_label')} *
                </label>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={handleAddImage} style={styles.fileBtn}>
                    📁 {t('add_series.select_file')}
                  </button>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: '#888',
                      fontStyle: 'italic',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {manualForm.image || t('add_series.no_file_selected')}
                  </span>
                </div>
              </div>

              <div style={styles.imageWrapper}>
                {(activeTab === 'auto' ? fetchedData?.image : manualForm.image) ? (
                  <img
                    src={
                      (activeTab === 'auto' ? fetchedData?.image : manualForm.image)?.startsWith(
                        'http'
                      )
                        ? activeTab === 'auto'
                          ? fetchedData?.image
                          : manualForm.image
                        : `file://${manualForm.image}`
                    }
                    alt="Önizleme"
                    style={styles.previewImage}
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ) : (
                  <div style={styles.placeholderImage}>{t('add_series.waiting_image')}</div>
                )}
              </div>

              <FormInput
                label={t('add_series.overview_label') + ' (' + t('common.optional') + ')'}
                value={manualForm.overview}
                onChange={(e) => handleManualChange('overview', e.target.value)}
                isTextArea={true}
              />

              <div
                style={{
                  marginTop: '20px',
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'flex-end',
                }}
              >
                <button style={styles.saveBtn} onClick={saveManual}>
                  {t('common.save')}
                </button>
              </div>
            </div>
          )}
        </div>
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          &larr; {t('add_series.cancel_back')}
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: { padding: '40px', height: '100%', overflowY: 'auto', color: 'white' },
  container: { maxWidth: '700px', margin: '0 auto' },
  tabHeader: { display: 'flex', borderBottom: '2px solid #333', marginBottom: '30px' },
  tab: {
    flex: 1,
    padding: '15px',
    background: 'transparent',
    border: 'none',
    color: '#777',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  activeTab: {
    flex: 1,
    padding: '15px',
    background: 'transparent',
    borderBottom: '2px solid #e50914',
    color: 'white',
    cursor: 'default',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  contentArea: { minHeight: '300px' },
  subTitle: { marginBottom: '20px', color: '#ddd' },
  input: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #444',
    backgroundColor: '#222',
    color: 'white',
    outline: 'none',
  },
  actionBtn: {
    padding: '0 25px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  error: {
    color: '#ef4444',
    background: 'rgba(239,68,68,0.1)',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  previewCard: {
    display: 'flex',
    gap: '20px',
    backgroundColor: '#1a1a1a',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #333',
  },
  previewPoster: { width: '120px', borderRadius: '8px', objectFit: 'cover' },
  badge: {
    display: 'inline-block',
    background: '#e50914',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    margin: '10px 0',
  },
  saveBtn: {
    padding: '12px 30px',
    backgroundColor: '#4ade80',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: '1px solid #555',
    color: '#ccc',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    marginTop: '30px',
    cursor: 'pointer',
  },
  fileBtn: {
    padding: '10px 15px',
    backgroundColor: '#333',
    border: '1px solid #555',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  imageWrapper: {
    margin: '20px 0',
    border: '1px dashed #444',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center',
    backgroundColor: '#181818',
  },
  previewImage: { maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' },
  placeholderImage: { color: '#666', padding: '40px', fontStyle: 'italic' },
};

export default AddSeriesPage;
